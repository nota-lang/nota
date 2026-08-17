;;; nota-mode.el --- Major mode for Nota documents -*- lexical-binding: t; -*-

;; Version: 0.1.0
;; Package-Requires: ((emacs "29.1"))
;; Keywords: languages, text
;; URL: https://github.com/nota-lang/nota

;;; Commentary:

;; A major mode for `.nota' documents: a conservative "never lie" font-lock
;; tier (a transliteration of the deleted vscode-nota TextMate grammar) plus
;; eglot wiring for the Volar-based `@nota-lang/language-server'.
;;
;; The font-lock tier only paints what is line-locally decidable; everything
;; context-sensitive (prop interiors, bodies, @(expr) heads, doc-state sugar,
;; verbatim re-arm) is left unpainted for the reader-driven LSP semantic
;; tokens (via e.g. `eglot-semtok') to paint faithfully.  Fenced regions
;; (``` code, $$ math, %%% statements, |{ }| verbatim) are marked as strings
;; via `syntax-propertize-function' so the inline rules cannot fire inside
;; them; their interiors render with `nota-raw'.

;;; Code:

(defgroup nota nil
  "Support for the Nota document language."
  :group 'languages
  :prefix "nota-")

;;;; Faces

(defface nota-sigil
  '((t :inherit font-lock-keyword-face))
  "Face for Nota sigils: @, line-leading %, and the colon-sugar colon."
  :group 'nota)

(defface nota-delimiter
  '((t :inherit font-lock-punctuation-face))
  "Face for structural markers: #, list markers, |, and raw-span delimiters."
  :group 'nota)

(defface nota-component
  '((t :inherit font-lock-type-face))
  "Face for capitalized component heads (@Cap)."
  :group 'nota)

(defface nota-tag
  '((t :inherit font-lock-function-name-face))
  "Face for lowercase host-element heads (@em, @aside)."
  :group 'nota)

(defface nota-interpolation
  '((t :inherit font-lock-variable-name-face))
  "Face for bare @name interpolations."
  :group 'nota)

(defface nota-escape
  '((t :inherit font-lock-escape-face))
  "Face for backslash escapes of Nota sigils."
  :group 'nota)

(defface nota-raw
  '((t :inherit font-lock-string-face))
  "Face for raw span content: inline code and fenced-region interiors."
  :group 'nota)

(defface nota-math
  '((t :inherit font-lock-string-face :slant italic))
  "Face for math span content ($...$ and $$...$$)."
  :group 'nota)

(defface nota-heading
  '((t :inherit bold))
  "Face merged over heading lines (# ... levels 1-6)."
  :group 'nota)

(defface nota-strong
  '((t :inherit bold))
  "Face for *strong* emphasis content."
  :group 'nota)

(defface nota-emphasis
  '((t :inherit italic))
  "Face for _italic_ emphasis content."
  :group 'nota)

(defface nota-strike
  '((t :strike-through t))
  "Face for ~~strikethrough~~ emphasis content."
  :group 'nota)

(defface nota-comment
  '((t :inherit font-lock-comment-face))
  "Face for markup comments (// line, /* block */)."
  :group 'nota)


;;;; Syntax table

(defvar nota-mode-syntax-table
  (let ((st (make-syntax-table text-mode-syntax-table)))
    ;; Prose, not code: no default string or escape syntax.  Raw regions are
    ;; introduced explicitly by `nota--syntax-propertize'.
    (modify-syntax-entry ?\" "." st)
    (modify-syntax-entry ?\\ "." st)
    (modify-syntax-entry ?` "." st)
    (modify-syntax-entry ?$ "." st)
    (modify-syntax-entry ?% "." st)
    (modify-syntax-entry ?| "." st)
    (modify-syntax-entry ?@ "." st)
    (modify-syntax-entry ?_ "_" st)
    (modify-syntax-entry ?- "_" st)
    st)
  "Syntax table for `nota-mode'.")

;;;; Fenced regions (syntax-propertize)

;; Each fence delimiter's first char is marked as a string quote.  String
;; quotes pair on the same character, so distinct fence types (` vs $ vs %
;; vs |) cannot mis-terminate one another, and a fence delimiter occurring
;; inside another fence's interior is inert.
(defconst nota--syntax-propertize
  (syntax-propertize-rules
   ;; %%% statement fence (3+ %s, matching the reader's `%{3,}`), alone on its line.
   ("^[ \t]*\\(%\\)%%%*[ \t]*$" (1 "\""))
   ;; ``` code fence (3+ backticks, optional language tag), line-anchored.
   ("^[ \t]*\\(`\\)``+[ \t]*[A-Za-z0-9_+#.-]*[ \t]*$" (1 "\""))
   ;; $$ display-math fence, alone on its line.
   ("^[ \t]*\\(\\$\\)\\$[ \t]*$" (1 "\""))
   ;; Multi-line verbatim: |{ at end of line ... }| at line start.
   ("\\(|\\){[ \t]*$" (1 "\""))
   ("^[ \t]*}\\(|\\)" (1 "\"")))
  "Value of `syntax-propertize-function' for `nota-mode'.")

(defun nota--syntactic-face (state)
  "Return the face for the syntactic context STATE: raw fence interiors."
  (when (nth 3 state) 'nota-raw))

;;;; Embedded JS/TS fontification

;; The Emacs analogue of the TextMate grammar's source.ts delegation (which the
;; server's semantic tokens deliberately defer to on these lines): the
;; line-locally decidable embedded-code regions -- a `%' statement line's rest,
;; `%%%' fence interiors, and ts/js/json code-fence interiors -- are fontified
;; natively by copying faces out of a hidden buffer running the real mode
;; (org-src style).  Chars the embedded mode leaves unfaced are protected with
;; `default' so the markup rules can never lie inside embedded code.

(defcustom nota-fontify-embedded t
  "Whether to fontify embedded JS/TS/JSON natively via their major modes."
  :type 'boolean
  :group 'nota)

(defun nota--mode-ready (mode &optional grammar)
  "MODE when it is loadable (and tree-sitter GRAMMAR, if any, is ready)."
  (and (fboundp mode)
       (or (null grammar)
           (and (fboundp 'treesit-ready-p)
                (treesit-ready-p grammar t)))
       mode))

(defun nota--embedded-mode (lang)
  "The major mode for embedded LANG code, or nil when none is available."
  (pcase (downcase (or lang ""))
    ((or "" "ts" "typescript")
     (or (nota--mode-ready 'typescript-ts-mode 'typescript)
         (nota--mode-ready 'js-mode)))
    ("tsx"
     (or (nota--mode-ready 'tsx-ts-mode 'tsx)
         (nota--mode-ready 'js-mode)))
    ((or "js" "javascript" "jsx" "mjs" "cjs")
     (or (nota--mode-ready 'js-ts-mode 'javascript)
         (nota--mode-ready 'js-mode)))
    ((or "json" "jsonc")
     (or (nota--mode-ready 'json-ts-mode 'json)
         (nota--mode-ready 'js-json-mode)))))

(defun nota--embedded-buffer (mode)
  "The hidden fontification buffer for MODE (created on first use).
Mode hooks are delayed so user hooks (eglot, etc.) never fire here."
  (let ((name (format " *nota-embedded:%s*" mode)))
    (or (get-buffer name)
        (with-current-buffer (get-buffer-create name)
          (delay-mode-hooks (funcall mode))
          (current-buffer)))))

(defun nota--fontify-embedded (beg end lang)
  "Fontify BEG..END in the current buffer as embedded LANG code.
Faces are copied from a hidden buffer in LANG's major mode; characters
that mode leaves unfaced get `default'.  When no mode is available the
whole region is protected with `default'."
  (when (< beg end)
    (let ((mode (and nota-fontify-embedded (nota--embedded-mode lang))))
      (or (and mode
               (condition-case nil
                   (let ((text (buffer-substring-no-properties beg end))
                         (target (current-buffer)))
                     (with-current-buffer (nota--embedded-buffer mode)
                       (erase-buffer)
                       (insert text)
                       (let ((noninteractive nil))
                         (font-lock-mode 1)
                         (font-lock-ensure))
                       (let ((pos (point-min)) next face)
                         (while (< pos (point-max))
                           (setq next (or (next-single-property-change pos 'face)
                                          (point-max))
                                 face (get-text-property pos 'face))
                           (with-current-buffer target
                             (put-text-property (+ beg (1- pos)) (+ beg (1- next))
                                                'face (or face 'default)))
                           (setq pos next))))
                     t)
                 (error nil)))
          (put-text-property beg end 'face 'default)))))

(defun nota--match-embedded-statements (limit)
  "Font-lock matcher: natively fontify % statement-line rests before LIMIT."
  (let (found)
    (while (and (not found)
                (re-search-forward "^[ \t]*%\\([^%\n].*\\)$" limit t))
      (let ((end (match-end 1)))
        (unless (nth 3 (syntax-ppss (match-beginning 0)))
          (nota--fontify-embedded (match-beginning 1) end "")
          (setq found t))
        (goto-char end)))
    (when found
      (set-match-data (list (point) (point)))
      t)))

(defconst nota--fence-open-re
  (concat "^[ \t]*\\(?:"
          "`\\{3,\\}[ \t]*\\([A-Za-z0-9_+#.-]*\\)[ \t]*"
          "\\|\\(%%%+\\)[ \t]*\\)$")
  "A code-fence (group 1: language tag) or %%% fence (group 2, 3+ %s) opening line.")

(defun nota--match-embedded-fences (limit)
  "Font-lock matcher: natively fontify embedded-code fence interiors.
Handles ```lang fences with a supported language and %%% statement
fences opening before LIMIT; other fences keep their raw paint."
  (let (found)
    (while (and (not found)
                (re-search-forward nota--fence-open-re limit t))
      (let* ((open-beg (match-beginning 0))
             (open-end (match-end 0))
             (statementp (match-beginning 2))
             (lang (if statementp "" (match-string-no-properties 1)))
             (close-re (if statementp "^[ \t]*%%%+[ \t]*$"
                         "^[ \t]*`\\{3,\\}[ \t]*$")))
        (if (or (nth 3 (syntax-ppss open-beg))          ; inside another fence
                (and (not statementp) (null (nota--embedded-mode lang))))
            (goto-char open-end)
          (let* ((body-beg (min (1+ open-end) (point-max)))
                 (close-beg (save-excursion
                              (goto-char body-beg)
                              (and (re-search-forward close-re nil t)
                                   (match-beginning 0))))
                 (body-end (or close-beg (point-max)))
                 (block-end (if close-beg
                                (save-excursion (goto-char close-beg)
                                                (line-end-position))
                              (point-max))))
            (nota--fontify-embedded body-beg body-end lang)
            (put-text-property open-beg block-end 'font-lock-multiline t)
            (goto-char block-end)
            (setq found t)))))
    (when found
      (set-match-data (list (point) (point)))
      t)))

;;;; Emphasis matchers

;; Emacs regexps lack lookaround, so the reader's word-boundary rule (an
;; emphasis delimiter opens/closes only against a non-letter/digit) is an
;; explicit char check around a delimiter-pair match.

(defconst nota--strong-re "\\(\\*\\)\\([^ \t\n*][^*\n]*?\\)\\(\\*\\)")
(defconst nota--em-re "\\(_\\)\\([^ \t\n_][^_\n]*?\\)\\(_\\)")

(defun nota--alnum-p (char)
  "Non-nil when CHAR is a letter or digit."
  (and char (string-match-p "[[:alpha:][:digit:]]" (char-to-string char))))

(defun nota--match-emphasis (regexp limit)
  "Match REGEXP before LIMIT where the delimiters sit on word boundaries."
  (let (found)
    (while (and (not found) (re-search-forward regexp limit t))
      (if (or (nota--alnum-p (char-before (match-beginning 0)))
              (nota--alnum-p (char-after (match-end 0))))
          (goto-char (1+ (match-beginning 0)))
        (setq found t)))
    found))

(defun nota--match-strong (limit)
  "Font-lock matcher for *strong* emphasis before LIMIT."
  (nota--match-emphasis nota--strong-re limit))

(defun nota--match-em (limit)
  "Font-lock matcher for _italic_ emphasis before LIMIT."
  (nota--match-emphasis nota--em-re limit))

;;;; Comment / strike matchers

;; Each of these fires only on UNCLAIMED text (no face yet): the rules above
;; them in `nota-font-lock-keywords' -- embedded code, raw spans -- have
;; already claimed their bytes, so a `//' inside a code span or a `~~' inside
;; embedded JS can never match.  This is the matcher-level analogue of the
;; nil-OVERRIDE ordering the rest of the tier relies on.

(defun nota--claimed-p (pos)
  "Non-nil when POS already carries a face or sits inside a fence string.
`syntax-ppss' may move point (it parses forward to POS), which would send
the calling matcher loop backwards — hence the `save-excursion'."
  (or (get-text-property pos 'face)
      (save-excursion (nth 3 (syntax-ppss pos)))))

(defun nota--match-unclaimed (regexp limit &optional guard)
  "Match REGEXP before LIMIT on unclaimed, unescaped text.
GUARD, when given, is called with no arguments after a candidate match
\(point at match end) and may reject it by returning nil."
  (let (found)
    (while (and (not found) (re-search-forward regexp limit t))
      (let ((beg (match-beginning 0)))
        (unless (or (nota--claimed-p beg)
                    (eq (char-before beg) ?\\)
                    (and guard (not (save-match-data (funcall guard)))))
          (setq found t))))
    found))

(defun nota--match-line-comment (limit)
  "Font-lock matcher for a // comment (to end of line) before LIMIT.
Rejected when an unclosed `[' precedes on the line — the `//' then sits
inside a prop group (`[href: \"https://…\"]`), where the slashes are
string content, not a comment (the reader-conformance test caught the
URL false paint)."
  (nota--match-unclaimed
   "//.*$" limit
   (lambda ()
     (let ((bol (line-beginning-position))
           (beg (match-beginning 0))
           (depth 0))
       (save-excursion
         (goto-char bol)
         (while (re-search-forward "[][]" beg t)
           (unless (eq (char-before (match-beginning 0)) ?\\)
             (setq depth (+ depth (if (string= (match-string 0) "[") 1 -1))))))
       (<= depth 0)))))

(defun nota--match-block-comment (limit)
  "Font-lock matcher for a same-line, *nesting-balanced* /* ... */ before LIMIT.
`/* a /* b */ c */' is ONE comment to the reader; matching to the first
`*/' would leave the tail as prose for the emphasis rules to mis-paint.
A block comment spanning lines is not line-locally decidable and stays
unpainted (the LSP semantic tokens own it)."
  (let (found)
    (while (and (not found) (re-search-forward "/\\*" limit t))
      (let ((start (match-beginning 0))
            (eol (line-end-position))
            (depth 1))
        (if (or (nota--claimed-p start) (eq (char-before start) ?\\))
            (goto-char (match-end 0))
          (while (and (> depth 0) (re-search-forward "/\\*\\|\\*/" eol t))
            (setq depth (+ depth (if (string= (match-string 0) "*/") -1 1))))
          (if (zerop depth)
              (progn (set-match-data (list start (point)))
                     (setq found t))
            (goto-char (min limit (1+ start)))))))
    found))

(defun nota--match-strike (limit)
  "Font-lock matcher for ~~strikethrough~~ before LIMIT."
  (nota--match-emphasis "\\(~~\\)\\([^ \t\n~][^~\n]*?\\)\\(~~\\)" limit))

(defun nota--match-heading-body (limit)
  "Font-lock matcher for heading lines before LIMIT, skipping raw fences."
  (let (found)
    (while (and (not found)
                (re-search-forward "^[ \t]*#\\{1,6\\}[ \t]+\\(.*\\)$" limit t))
      (unless (nth 3 (syntax-ppss (match-beginning 0)))
        (setq found t)))
    found))

;;;; Font-lock keywords

;; All rules are single-line and use nil OVERRIDE, so earlier rules win --
;; the elisp equivalent of TextMate's earliest-match/list-order tie-break in
;; the "never lie" grammar this transliterates.  Constructs that are not
;; line-locally decidable are deliberately left unpainted.
(defconst nota-font-lock-keywords
  `(;; Embedded-code regions first: native JS/TS/JSON faces claim their
    ;; bytes before any markup rule can touch them (the delegation tier).
    (nota--match-embedded-fences (0 nil nil t))
    (nota--match-embedded-statements (0 nil nil t))
    ;; Backslash escapes — universal, exactly the reader's rule (`\<c>` is literal `<c>` for any
    ;; character; the old hand-picked charset was a silent subset).
    ("\\\\." 0 'nota-escape)
    ;; Line-leading % statement sigil (the JS rest is owned by the embedded
    ;; fontification above, mirroring the TextMate source.ts delegation).
    ("^[ \t]*\\(%\\)\\(?:[^%\n].*\\)?$" 1 'nota-sigil)
    ;; Heading marker (1-6 #s then whitespace).
    ("^[ \t]*\\(#\\{1,6\\}\\)[ \t]" 1 'nota-delimiter)
    ;; Thematic break: a run of 3+ dashes alone on its line (a `- ` list
    ;; marker needs its space, so the two rules cannot collide).
    ("^[ \t]*\\(-\\{3,\\}\\)[ \t]*$" 1 'nota-delimiter)
    ;; List markers: - / + bullets and N. ordered — one literal *space* after the marker,
    ;; exactly the reader's `LIST_MARKER` (a tab does not open a list there).
    ("^[ \t]*\\([-+]\\) " 1 'nota-delimiter)
    ("^[ \t]*\\([0-9]+\\.\\) " 1 'nota-delimiter)
    ;; Block-sugar prop line marker — bare `|` suffices (the reader's `PROP_LINE` requires no
    ;; trailing whitespace; `|width: 10` is a valid prop line).
    ("^[ \t]*\\(|\\)" 1 'nota-delimiter)
    ;; Control-flow head @if/@for, only when followed by a `(' head.
    ("\\(@\\)\\(if\\|for\\)\\>[ \t]*("
     (1 'nota-sigil) (2 'font-lock-keyword-face))
    ;; Line-leading colon-sugar element head @head: (mid-line @x: is an
    ;; interpolation + literal colon, handled below).
    ("^[ \t]*\\(@\\)\\([A-Z][A-Za-z0-9_-]*\\)\\(:\\)"
     (1 'nota-sigil) (2 'nota-component) (3 'nota-sigil))
    ("^[ \t]*\\(@\\)\\([a-z][A-Za-z0-9_-]*\\)\\(:\\)"
     (1 'nota-sigil) (2 'nota-tag) (3 'nota-sigil))
    ;; Same-line verbatim |{ ... }|: delimiters painted, interior protected
    ;; (it may be raw text or re-armed markup -- not line-locally decidable).
    ("\\(|{\\)\\([^\n]*?\\)\\(}|\\)"
     (1 'nota-delimiter) (2 'default) (3 'nota-delimiter))
    ;; Inline code: equal-length backtick runs on one line.
    ("\\(`+\\)\\([^`\n]*\\)\\(\\1\\)"
     (1 'nota-delimiter) (2 'nota-raw) (3 'nota-delimiter))
    ;; Single-line display math, tried before inline math.
    ("\\(\\$\\$\\)\\([^\n]*?\\)\\(\\$\\$\\)"
     (1 'nota-delimiter) (2 'nota-math) (3 'nota-delimiter))
    ;; Inline math.
    ("\\(\\$\\)\\([^$\n]+\\)\\(\\$\\)"
     (1 'nota-delimiter) (2 'nota-math) (3 'nota-delimiter))
    ;; Comments (after the raw spans, whose interiors keep `//` literal; the
    ;; matchers fire on unclaimed text only). Multi-line /* */ stays unpainted.
    (nota--match-line-comment 0 'nota-comment)
    (nota--match-block-comment 0 'nota-comment)
    ;; Element heads glued to a trigger ([, {, or |{): unambiguous tags.
    ("\\(@\\)\\([A-Z][A-Za-z0-9_-]*\\)\\(?:\\[\\|{\\||{\\)"
     (1 'nota-sigil) (2 'nota-component))
    ("\\(@\\)\\([a-z][A-Za-z0-9_-]*\\)\\(?:\\[\\|{\\||{\\)"
     (1 'nota-sigil) (2 'nota-tag))
    ;; Bare @( dynamic tag / @{ fragment: claim just the sigil.
    ("\\(@\\)[({]" 1 'nota-sigil)
    ;; Bare @name interpolation (element/control/colon rules already claimed
    ;; their cases above, so nil-override skips them here).
    ("\\(@\\)\\([A-Za-z_$][A-Za-z0-9_$]*\\)"
     (1 'nota-sigil) (2 'nota-interpolation))
    ;; Emphasis, with the reader's word-boundary guards.
    (nota--match-strong
     (1 'nota-delimiter) (2 'nota-strong) (3 'nota-delimiter))
    (nota--match-em
     (1 'nota-delimiter) (2 'nota-emphasis) (3 'nota-delimiter))
    (nota--match-strike
     (1 'nota-delimiter) (2 'nota-strike) (3 'nota-delimiter))
    ;; Heading overlay, merged over the inline faces painted above.
    (nota--match-heading-body (1 'nota-heading append)))
  "Font-lock keywords for `nota-mode'.")

;;;; Language server (eglot)

(defconst nota--source-directory
  (file-name-directory (or load-file-name buffer-file-name default-directory))
  "Directory this file was loaded from, for locating an in-repo server.")

(defun nota--locate-language-server ()
  "Locate the Nota language server launch command.
Prefer the in-repo build when this file lives inside a nota checkout;
otherwise fall back to a `nota-language-server' binary on `exec-path'."
  (let ((bin (expand-file-name "../../packages/language-server/dist/bin.js"
                               nota--source-directory)))
    (if (file-exists-p bin)
        (list "node" bin "--stdio")
      (list "nota-language-server" "--stdio"))))

(defcustom nota-language-server-command (nota--locate-language-server)
  "Command used to launch the Nota language server over stdio."
  :type '(repeat string)
  :group 'nota)

(defun nota--eglot-contact (&rest _)
  "Eglot contact function: the current `nota-language-server-command'."
  nota-language-server-command)

(defvar eglot-server-programs)

(with-eval-after-load 'eglot
  (add-to-list 'eglot-server-programs '(nota-mode . nota--eglot-contact)))

;;;; Mode

;;;###autoload
(define-derived-mode nota-mode text-mode "Nota"
  "Major mode for editing Nota documents.

Provides a conservative first-paint font-lock tier; full-fidelity
highlighting and TS-backed language features come from the Nota
language server via eglot (see `nota-language-server-command')."
  (setq-local font-lock-defaults
              '(nota-font-lock-keywords nil nil nil
                (font-lock-syntactic-face-function . nota--syntactic-face)))
  (setq-local syntax-propertize-function nota--syntax-propertize)
  (setq-local outline-regexp "[ \t]*#\\{1,6\\}[ \t]")
  (setq-local paragraph-start
              (concat paragraph-start "\\|[ \t]*#\\{1,6\\}[ \t]")))

;;;###autoload
(add-to-list 'auto-mode-alist '("\\.nota\\'" . nota-mode))

(provide 'nota-mode)

;;; nota-mode.el ends here
