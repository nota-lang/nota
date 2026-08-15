;;; nota-mode-test.el --- ERT tests for nota-mode -*- lexical-binding: t; -*-

;;; Commentary:

;; Font-lock classification tests for the conservative "never lie" tier.
;; Run: emacs -Q --batch -L .. -l nota-mode-test.el -f ert-run-tests-batch-and-exit

;;; Code:

(require 'ert)
(require 'nota-mode)

(defconst nota-test--directory
  (file-name-directory (or load-file-name buffer-file-name))
  "Directory containing this test file, captured at load time.")

(defmacro nota-test--with-buffer (text &rest body)
  "Fontify TEXT in a `nota-mode' temp buffer and evaluate BODY."
  (declare (indent 1))
  `(with-temp-buffer
     (let ((noninteractive nil))
       (insert ,text)
       (nota-mode)
       (font-lock-mode 1)
       (font-lock-ensure))
     (goto-char (point-min))
     ,@body))

(defun nota-test--face-at (pos)
  "The face property at POS, normalized to a list."
  (let ((f (get-text-property pos 'face)))
    (if (listp f) f (list f))))

(defun nota-test--face-of (needle face &optional offset)
  "Non-nil when FACE is on the char at OFFSET (default 0) into NEEDLE.
Searches forward from point for NEEDLE."
  (save-excursion
    (search-forward needle)
    (memq face (nota-test--face-at (+ (match-beginning 0) (or offset 0))))))

(defun nota-test--unfontified (needle &optional offset)
  "Non-nil when the char at OFFSET into NEEDLE has no face at all."
  (save-excursion
    (search-forward needle)
    (null (get-text-property (+ (match-beginning 0) (or offset 0)) 'face))))

;;;; Mode basics

(ert-deftest nota-mode-auto-mode-alist ()
  (should (eq (assoc-default "doc.nota" auto-mode-alist #'string-match)
              'nota-mode)))

;;;; Headings & markers

(ert-deftest nota-heading-marker-and-body ()
  (nota-test--with-buffer "# Hello Nota\n"
    (should (nota-test--face-of "#" 'nota-delimiter))
    (should (nota-test--face-of "Hello" 'nota-heading))))

(ert-deftest nota-heading-nests-inline ()
  (nota-test--with-buffer "## A *bold* head\n"
    (should (nota-test--face-of "bold" 'nota-strong))
    (should (nota-test--face-of "bold" 'nota-heading))))

(ert-deftest nota-list-markers ()
  (nota-test--with-buffer "- first\n+ second\n3. third\n"
    (should (nota-test--face-of "- " 'nota-delimiter))
    (should (nota-test--face-of "+ " 'nota-delimiter))
    (should (nota-test--face-of "3." 'nota-delimiter))
    (should (nota-test--unfontified "first"))))

(ert-deftest nota-prop-line-marker ()
  (nota-test--with-buffer "| width: 10\n"
    (should (nota-test--face-of "|" 'nota-delimiter))
    (should (nota-test--unfontified "width"))))

;;;; Elements, interpolation, control

(ert-deftest nota-host-element-head ()
  (nota-test--with-buffer "Hello @em{world}\n"
    (should (nota-test--face-of "@em" 'nota-sigil))
    (should (nota-test--face-of "em{" 'nota-tag))
    (should (nota-test--unfontified "world"))))

(ert-deftest nota-component-element-head ()
  (nota-test--with-buffer "@Note[kind: \"aside\"]{hi}\n"
    (should (nota-test--face-of "@Note" 'nota-sigil))
    (should (nota-test--face-of "Note[" 'nota-component))))

(ert-deftest nota-interpolation ()
  (nota-test--with-buffer "Hello @name.\n"
    (should (nota-test--face-of "@name" 'nota-sigil))
    (should (nota-test--face-of "name." 'nota-interpolation))))

(ert-deftest nota-at-sigil-only-for-expr-and-fragment ()
  (nota-test--with-buffer "@(user.name) and @{a fragment}\n"
    (should (nota-test--face-of "@(user" 'nota-sigil))
    (should (nota-test--unfontified "user."))
    (should (nota-test--face-of "@{a" 'nota-sigil))))

(ert-deftest nota-control-keywords ()
  (nota-test--with-buffer "@if (x > 0) {yes} @for (i of xs) {@i}\n"
    (should (nota-test--face-of "if (x" 'font-lock-keyword-face))
    (should (nota-test--face-of "for (i" 'font-lock-keyword-face))))

(ert-deftest nota-if-without-paren-is-interpolation ()
  (nota-test--with-buffer "email @if you can\n"
    (should (nota-test--face-of "if you" 'nota-interpolation))
    (should-not (nota-test--face-of "if you" 'font-lock-keyword-face))))

(ert-deftest nota-colon-sugar-line-leading-only ()
  (nota-test--with-buffer "@section: Intro\nsee @user: profile\n"
    (should (nota-test--face-of "section" 'nota-tag))
    (should (nota-test--face-of ": Intro" 'nota-sigil))
    ;; Mid-line @user: is interpolation + literal colon.
    (should (nota-test--face-of "user:" 'nota-interpolation))
    (should (nota-test--unfontified ": profile"))))

(ert-deftest nota-colon-sugar-component ()
  (nota-test--with-buffer "@Theorem: statement\n"
    (should (nota-test--face-of "Theorem" 'nota-component))))

;;;; Emphasis

(ert-deftest nota-emphasis-basic ()
  (nota-test--with-buffer "a *bold* and _italic_ word\n"
    (should (nota-test--face-of "bold" 'nota-strong))
    (should (nota-test--face-of "italic" 'nota-emphasis))))

(ert-deftest nota-emphasis-word-boundary-guards ()
  (nota-test--with-buffer "compute 2*3*4 and my_var_name here\n"
    (should (nota-test--unfontified "3"))
    (should (nota-test--unfontified "var"))))

;;;; Raw spans

(ert-deftest nota-inline-code ()
  (nota-test--with-buffer "use `f(*x*)` here\n"
    (should (nota-test--face-of "f(" 'nota-raw))
    ;; No emphasis inside a claimed code span.
    (should-not (nota-test--face-of "x" 'nota-strong))))

(ert-deftest nota-inline-math ()
  (nota-test--with-buffer "let $x + y$ and $$e = mc^2$$ stand\n"
    (should (nota-test--face-of "x +" 'nota-math))
    (should (nota-test--face-of "mc" 'nota-math))))

(ert-deftest nota-escapes ()
  (nota-test--with-buffer "mail \\@ home costs \\$5\n"
    (should (nota-test--face-of "\\@" 'nota-escape))
    (should (nota-test--face-of "\\$" 'nota-escape))))

;;;; Statement lines & fences

(ert-deftest nota-statement-line ()
  (nota-test--with-buffer "%let x = \"_not italic_\"\n"
    (should (nota-test--face-of "%" 'nota-sigil))
    ;; The JS rest is natively fontified: `let` is a keyword, the string a string.
    (should (nota-test--face-of "let x" 'font-lock-keyword-face))
    (should (nota-test--face-of "not italic" 'font-lock-string-face))
    ;; And no markup lies inside embedded JS.
    (should-not (nota-test--face-of "not italic" 'nota-emphasis))))

(ert-deftest nota-statement-fence ()
  (nota-test--with-buffer "%%%\nlet s = 1;\nlet t = \"*not bold*\";\n%%%\nafter *strong*\n"
    ;; The interior is natively fontified TS, not raw string paint.
    (should (nota-test--face-of "let s" 'font-lock-keyword-face))
    (should-not (nota-test--face-of "not bold" 'nota-strong))
    ;; The fence closes: markup resumes after it.
    (should (nota-test--face-of "strong" 'nota-strong))))

(ert-deftest nota-code-fence ()
  (nota-test--with-buffer "```ts\nconst a = notATag(x);\n```\ntail @em{y}\n"
    (should (nota-test--face-of "const" 'font-lock-keyword-face))
    (should-not (nota-test--face-of "notATag" 'nota-tag))
    (should (nota-test--face-of "em{y}" 'nota-tag))))

(ert-deftest nota-code-fence-unknown-lang-stays-raw ()
  (nota-test--with-buffer "```python\ndef f(): pass\n```\ndone\n"
    (should (nota-test--face-of "def f" 'nota-raw))
    (should-not (nota-test--face-of "def f" 'font-lock-keyword-face))))

(ert-deftest nota-embedded-js-protected-from-markup ()
  ;; Chars the embedded mode leaves unfaced are still claimed (with `default'),
  ;; so markup rules cannot fire anywhere inside embedded code.
  (nota-test--with-buffer "%let y = a_b(c) * d_e(f)\n"
    (should-not (nota-test--face-of "b(c" 'nota-emphasis))
    (should-not (nota-test--face-of "d_e" 'nota-strong))))

(ert-deftest nota-math-fence ()
  (nota-test--with-buffer "$$\n\\frac{1}{2}\n$$\nplain\n"
    (should (nota-test--face-of "frac" 'nota-raw))
    (should (nota-test--unfontified "plain"))))

(ert-deftest nota-verbatim-fence ()
  (nota-test--with-buffer "@pre|{\n@foo{not a tag}\n}|\nthen @em{z}\n"
    ;; The head before |{ is a real tag.
    (should (nota-test--face-of "pre" 'nota-tag))
    ;; The interior is raw: no element painting.
    (should-not (nota-test--face-of "foo" 'nota-tag))
    (should (nota-test--face-of "@foo" 'nota-raw))
    ;; After }| markup resumes.
    (should (nota-test--face-of "em{z}" 'nota-tag))))

(ert-deftest nota-verbatim-inline ()
  (nota-test--with-buffer "@code|{ raw @x }| then @y\n"
    (should (nota-test--face-of "|{" 'nota-delimiter))
    ;; Interior protected (claimed as default, not interpolation).
    (should-not (nota-test--face-of "x }" 'nota-interpolation))
    (should (nota-test--face-of "y\n" 'nota-interpolation))))

;;;; Integration corpus smoke: fontification must not error.

(ert-deftest nota-fontify-integration-corpus ()
  (let ((dir (expand-file-name "../../../integration" nota-test--directory)))
    (dolist (f (directory-files dir t "\\.nota\\'"))
      (with-temp-buffer
        (let ((noninteractive nil))
          (insert-file-contents f)
          (nota-mode)
          (font-lock-mode 1)
          (should (progn (font-lock-ensure) t)))))))

(provide 'nota-mode-test)

;;; nota-mode-test.el ends here
