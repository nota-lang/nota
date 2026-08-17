;;; conformance.el --- reader-vs-font-lock subset-correctness -*- lexical-binding: t; -*-

;; The "never lie" contract, checked against the reader: every `nota-*'-faced character in a
;; fontified `integration/*.nota' buffer must be justified by a reader highlight span covering
;; that byte, with a kind the face legitimately renders. Missing paint is fine (the font-lock
;; tier is deliberately conservative); paint the reader contradicts is a failure.
;;
;; Three checks run here:
;;  1. Subset-correctness over the integration corpus (as above), guarded by a POSITIVE FLOOR --
;;     zero files matched, or zero `nota-*' faced characters seen across all of them, is a
;;     harness failure, not "OK" (a broken corpus path or a wholly-unfontified buffer must not
;;     look like a clean pass).
;;  2. A VOCABULARY check: every reader-kind name named in `nota-conf--face-kinds' below must be
;;     a real member of the reader's `highlightKindNames()' -- a typo'd kind name is silently
;;     inert (it just never matches any span) rather than erroring, so it needs its own check.
;;  3. FENCE-AGREEMENT cases: the shared elisp fence defconsts (`nota-mode.el' "Fence grammar")
;;     are checked against the reader on a table of edge-case lines, so drift there fails this
;;     suite instead of hiding behind the `nota-raw' exemption below (a whole fence interior
;;     paints raw regardless of exactly where the elisp scanner thinks the boundary is, so a
;;     wrong boundary is invisible to check 1).
;;
;; Ground truth comes from `dump-spans.mjs' and `dump-classifiers.mjs' (the wasm reader via
;; @nota-lang/compiler -- build the compiler first). Run:
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

;;;; 1. Subset-correctness over the integration corpus

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
  "Check one file; return (VIOLATIONS . FACED-COUNT).  FACED-COUNT is the number of
`nota-*'-faced characters seen — the positive floor's evidence that fontification actually ran."
  (let ((violations '())
        (faced-count 0))
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
            (setq faced-count (1+ faced-count))
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
    (cons (nreverse violations) faced-count)))

;;;; 2 & 3. Vocabulary + fence-agreement ground truth

(defconst nota-conf--fence-cases
  '(((name . "percent-open-indented") (family . "percent") (role . "open")
     (line . "   %%%"))
    ((name . "percent-close-trailing-content") (family . "percent") (role . "close")
     (line . "%%%!!!"))
    ((name . "percent-close-more-delims-than-open") (family . "percent") (role . "close")
     (line . "%%%%%"))
    ((name . "backtick-open-indented") (family . "backtick") (role . "open")
     (line . "   ```js"))
    ((name . "backtick-close-trailing-content") (family . "backtick") (role . "close")
     (line . "```!!!"))
    ((name . "backtick-close-more-ticks-than-open") (family . "backtick") (role . "close")
     (line . "`````")))
  "Fence-delimiter edge cases (a subset-correctness table like `nota-conf--face-kinds' above):
each `line' is checked as the given `role' (open/close) of the given `family' (percent/backtick)
fence, comparing the shared elisp defconsts in `nota-mode.el' \"Fence grammar\" against the
reader — see `nota-conf--classifiers' and `dump-classifiers.mjs'.")

(defun nota-conf--classifiers ()
  "The reader's highlight-kind vocabulary and `nota-conf--fence-cases' verdicts, via the node
dumper.  Returns an alist with `kindNames' (list of strings) and `cases' (list of alists, each
an input case plus `readerVerdict')."
  (let ((cases-file (make-temp-file "nota-fence-cases" nil ".json"))
        (out-file (make-temp-file "nota-classifiers" nil ".json")))
    (with-temp-file cases-file
      (insert (json-serialize (vconcat nota-conf--fence-cases))))
    (unless (zerop (call-process "node" nil "*nota-dump*" nil
                                 (expand-file-name "dump-classifiers.mjs" nota-conf--dir)
                                 cases-file out-file))
      (with-current-buffer "*nota-dump*" (message "%s" (buffer-string)))
      (error "dump-classifiers.mjs failed (is packages/compiler built?)"))
    (with-temp-buffer
      (insert-file-contents out-file)
      (json-parse-buffer :object-type 'alist :array-type 'list))))

(defun nota-conf--check-vocabulary (kind-names)
  "Violation strings: any `nota-conf--face-kinds' entry naming a kind absent from KIND-NAMES."
  (let ((violations '()))
    (dolist (entry nota-conf--face-kinds)
      (dolist (kind (cdr entry))
        (unless (member kind kind-names)
          (push (format "face %s allows reader kind %S, not in highlightKindNames() (typo?)"
                        (car entry) kind)
                violations))))
    (nreverse violations)))

(defun nota-conf--elisp-fence-verdict (family role line)
  "The elisp fence-defconst verdict (t or nil) for LINE, per FAMILY/ROLE strings."
  (and (string-match-p
        (cond ((and (string= family "percent") (string= role "open"))
               nota--percent-fence-open-re)
              ((string= family "percent") nota--percent-fence-close-re)
              ((string= role "open") nota--backtick-fence-open-re)
              (t nota--backtick-fence-close-re))
        line)
       t))

(defun nota-conf--check-fence-cases (cases)
  "Violation strings: any CASES entry where the elisp verdict disagrees with `readerVerdict'."
  (let ((violations '()))
    (dolist (fcase cases)
      (let* ((name (alist-get 'name fcase))
             (family (alist-get 'family fcase))
             (role (alist-get 'role fcase))
             (line (alist-get 'line fcase))
             (reader (eq (alist-get 'readerVerdict fcase) t))
             (elisp (nota-conf--elisp-fence-verdict family role line)))
        (unless (eq elisp reader)
          (push (format "fence case %s (%s %s %S): elisp says %S, reader says %S"
                        name family role line elisp reader)
                violations))))
    (nreverse violations)))

;;;; Driver

(let* ((all (nota-conf--spans))
       (classified (nota-conf--classifiers))
       (violations '())
       (total-faced 0))
  (dolist (entry all)
    (let* ((name (symbol-name (car entry)))
           (result (nota-conf--check-file name (cdr entry))))
      (setq violations (append violations (car result)))
      (setq total-faced (+ total-faced (cdr result)))))
  (setq violations
        (append violations
                (nota-conf--check-vocabulary (alist-get 'kindNames classified))
                (nota-conf--check-fence-cases (alist-get 'cases classified))))
  (cond
   ;; Positive floor: an empty corpus or a wholly-unfontified corpus must fail loudly, not read
   ;; as "0 violations, OK".
   ((zerop (length all))
    (message "NOTA CONFORMANCE FAILED: matched zero integration/*.nota files")
    (kill-emacs 1))
   ((zerop total-faced)
    (message "NOTA CONFORMANCE FAILED: zero nota-* faced characters across %d files (did fontification even run?)"
              (length all))
    (kill-emacs 1))
   ((null violations)
    (message "NOTA CONFORMANCE OK (%d files, %d faced chars, %d fence cases)"
              (length all) total-faced (length nota-conf--fence-cases)))
   (t
    (dolist (v (seq-take violations 40))
      (message "VIOLATION %s" v))
    (message "%d violations" (length violations))
    (kill-emacs 1))))
