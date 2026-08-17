;;; conformance.el --- reader-vs-font-lock subset-correctness -*- lexical-binding: t; -*-

;; The "never lie" contract, checked against the reader: every `nota-*'-faced character in a
;; fontified `integration/*.nota' buffer must be justified by a reader highlight span covering
;; that byte, with a kind the face legitimately renders. Missing paint is fine (the font-lock
;; tier is deliberately conservative); paint the reader contradicts is a failure.
;;
;; Ground truth comes from `dump-spans.mjs' (the wasm reader via @nota-lang/compiler — build the
;; compiler first). Run:
;;   emacs -Q --batch -L editors/emacs -l editors/emacs/tests/conformance.el

(require 'json)
(require 'nota-mode)

(defconst nota-conf--dir
  (file-name-directory (or load-file-name buffer-file-name)))
(defconst nota-conf--repo (expand-file-name "../../.." nota-conf--dir))

;; Face → the reader kinds that justify it. A face may appear wherever ANY covering span has one
;; of its kinds. `nota-raw' is deliberately ABSENT: it is the coarse syntactic string paint over
;; whole fence/verbatim constructs, and the mode's documented conservatism paints armed verbatim
;; interiors (`|@…` re-entry) raw wholesale — under-paint by design, so checking it against span
;; families yields only false positives. Every precise face below is checked strictly.
(defconst nota-conf--face-kinds
  '((nota-sigil . ("sigil"))
    (nota-tag . ("tag-host"))
    (nota-component . ("tag-component"))
    (nota-interpolation . ("interpolation"))
    (nota-delimiter . ("heading-marker" "list-marker" "math-delim" "code-delim" "sigil"))
    (nota-escape . ("escape"))
    ;; Armed math interiors (`$a_|@(x)$`) paint math wholesale — the mode's documented
    ;; conservatism (no `|@` re-entry) — so the armed family justifies the face too.
    (nota-math . ("math" "math-delim" "interpolation" "sigil"
                  "js-keyword" "js-string" "js-number" "js-operator" "js-comment"))
    (nota-heading . ("heading"))
    (nota-strong . ("emphasis-strong"))
    (nota-emphasis . ("emphasis-em"))
    (nota-strike . ("emphasis-strike"))
    (nota-comment . ("comment"))))

(defun nota-conf--spans ()
  "Reader spans per integration file, via the node dumper."
  (let ((json-file (make-temp-file "nota-spans" nil ".json")))
    (unless (zerop (call-process "node" nil "*nota-dump*" nil
                                 (expand-file-name "dump-spans.mjs" nota-conf--dir)
                                 json-file))
      (with-current-buffer "*nota-dump*" (message "%s" (buffer-string)))
      (error "dump-spans.mjs failed (is packages/compiler built?)"))
    (with-temp-buffer
      (insert-file-contents json-file)
      (json-parse-buffer :object-type 'alist :array-type 'list))))

(defun nota-conf--faces-at (pos)
  "The nota-* faces on POS, as a list."
  (let ((f (get-text-property pos 'face)))
    (seq-filter (lambda (face)
                  (and (symbolp face)
                       (string-prefix-p "nota-" (symbol-name face))))
                (if (listp f) f (list f)))))

(defun nota-conf--check-file (name spans)
  "Check one file; return a list of violation strings."
  (let ((violations '()))
    (with-temp-buffer
      (insert-file-contents
       (expand-file-name (format "integration/%s" name) nota-conf--repo))
      (let ((noninteractive nil))
        (nota-mode)
        (font-lock-mode 1)
        (font-lock-ensure))
      (goto-char (point-min))
      (while (< (point) (point-max))
        (let* ((pos (point))
               (byte (1- (position-bytes pos)))
               (faces (nota-conf--faces-at pos)))
          (dolist (face faces)
            (let ((allowed (alist-get face nota-conf--face-kinds))
                  (covering '()))
              (dolist (span spans)
                (let ((start (alist-get 'start span))
                      (end (alist-get 'end span)))
                  (when (and (<= start byte) (< byte end))
                    (push (alist-get 'kind span) covering))))
              (when (and allowed
                         ;; `nota-math' may cover unspanned bytes (the whitespace between an
                         ;; armed interior's JS tokens carries no reader span).
                         (not (and (eq face 'nota-math) (null covering)))
                         (not (seq-intersection covering allowed)))
                (push (format "%s:%d byte %d: face %s but reader kinds %S (char %S)"
                              name (line-number-at-pos pos) byte face covering
                              (buffer-substring-no-properties pos (min (point-max) (+ pos 8))))
                      violations)))))
        (forward-char 1)))
    (nreverse violations)))

(let* ((all (nota-conf--spans))
       (violations '()))
  (dolist (entry all)
    (let ((name (symbol-name (car entry))))
      (setq violations
            (append violations (nota-conf--check-file name (cdr entry))))))
  (if (null violations)
      (message "NOTA CONFORMANCE OK (%d files)" (length all))
    (dolist (v (seq-take violations 40))
      (message "VIOLATION %s" v))
    (message "%d violations" (length violations))
    (kill-emacs 1)))
