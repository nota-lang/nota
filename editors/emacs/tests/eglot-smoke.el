;;; eglot-smoke.el --- batch e2e: nota-mode + eglot + language server -*- lexical-binding: t; -*-

;;; Commentary:

;; End-to-end smoke test: open a `.nota' buffer inside the repo, connect
;; eglot to the resurrected `@nota-lang/language-server', and assert that
;; (a) the connection establishes, (b) a TS type error injected into the
;; buffer surfaces as a flymake diagnostic mapped back to `.nota'
;; coordinates, and (c) hover answers over the virtual `.tsx'.
;;
;; Run: emacs -Q --batch -L .. -l eglot-smoke.el

;;; Code:

(require 'nota-mode)
(require 'eglot)

(defconst nota-smoke--root
  (expand-file-name "../../.."
                    (file-name-directory (or load-file-name buffer-file-name)))
  "The nota repo root.")

(defun nota-smoke--wait (pred what &optional secs)
  "Spin until PRED returns non-nil or SECS (default 30) elapse.
Signal an error mentioning WHAT on timeout; return PRED's value."
  (let ((deadline (+ (float-time) (or secs 30)))
        result)
    (while (and (not (setq result (funcall pred)))
                (< (float-time) deadline))
      (accept-process-output nil 0.1)
      (sit-for 0.05))
    (or result (error "Timed out waiting for %s" what))))

(let* ((file (make-temp-file
              (expand-file-name "integration/emacs-smoke-" nota-smoke--root)
              nil ".nota"))
       (ok nil))
  (unwind-protect
      (progn
        (with-temp-file file
          (insert "%let Note = blockComponent((children) => @aside{@children})\n"
                  "@Note{Hello @em{world}}\n"
                  "%let bad: number = \"str\";\n"))
        (with-current-buffer (find-file-noselect file)
          (unless (derived-mode-p 'nota-mode)
            (error "Expected nota-mode, got %s" major-mode))
          ;; `eglot-ensure' defers to an idle timer that is unreliable in
          ;; batch; connect synchronously the way `M-x eglot' does.
          (apply #'eglot--connect (eglot--guess-contact))
          (let ((server (nota-smoke--wait #'eglot-current-server
                                          "eglot connection")))
            (message "connected: %s"
                     (process-name (jsonrpc--process server)))
            ;; (b) diagnostics: the injected `%let bad: number = "str"'.
            (flymake-start)
            (let ((diags (nota-smoke--wait
                          (lambda ()
                            (seq-filter
                             (lambda (d)
                               (string-match-p "not assignable"
                                               (flymake-diagnostic-text d)))
                             (flymake-diagnostics)))
                          "TS diagnostic via flymake")))
              (message "diagnostic: %s"
                       (flymake-diagnostic-text (car diags))))
            ;; (c) hover on `Note' (line 0, after "%let ").
            (goto-char (point-min))
            (search-forward "Note")
            (goto-char (match-beginning 0))
            (let ((hover (jsonrpc-request
                          server :textDocument/hover
                          (eglot--TextDocumentPositionParams))))
              (unless (and hover (plist-get hover :contents))
                (error "Empty hover result"))
              (message "hover: %S" (plist-get hover :contents)))
            (setq ok t))))
    (when-let* ((buf (get-file-buffer file)))
      (when-let* ((server (with-current-buffer buf (eglot-current-server))))
        (ignore-errors (eglot-shutdown server nil 5)))
      (kill-buffer buf))
    (delete-file file))
  (message (if ok "EGLOT SMOKE OK" "EGLOT SMOKE FAILED"))
  (kill-emacs (if ok 0 1)))

;;; eglot-smoke.el ends here
