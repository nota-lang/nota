from TexSoup import TexSoup
from TexSoup.data import *
from TexSoup.utils import Token
import fileinput
import re 

stdin = '\n'.join(list(fileinput.input()))

command_map = {
  'noindent': None,
  'textwidth': None,
  'vspace': None,
  'rust': 'Code'
}

def translate_one(elem):
  if isinstance(elem, TexText):
    return elem.strip()
  if isinstance(elem, Token):
    if elem.strip() == '%':
      return ''
    else:
      return elem.strip()
  elif isinstance(elem, TexCmd):
    args = translate(elem.args)
    if elem.name in ['noindent', 'textwidth', 'vspace']:
      return ''
    elif elem.name in ['hbox', 'mbox']:
      return args
    elif elem.name in ['item']:
      return translate(elem.all)
    elif elem.name == 'emph':
      return f'<em>{args}</em>'
    elif elem.name == 'rust' or elem.name == 'Verb':
      return f'<C>{args}</C>'
    elif elem.name == 'Cref' or elem.name == 'ref':
      return f'<Ref name="{args}" />'
    elif elem.name == 'cite':
      return f'<Cite v="{args}" />'
    elif elem.name == 'citet':
      return f'<Cite f v="{args}" />'
    elif elem.name == 'footnote':
      return f'<Footnote>{args}</Footnote>'
    else:
      raise Exception("cmd", type(elem), elem.name)
  elif isinstance(elem, (BraceGroup, BracketGroup)):
    return translate(elem.all)
  elif isinstance(elem, TexEnv):
    if elem.name == 'minipage':
        return translate(elem.children)
    elif elem.name == 'lstlisting':
      return f'<Listing code={{r`{translate(elem.all)}`}} />'
    elif elem.name == 'wrapfigure':
      direc = 'right' if elem.args[1].all[0] == 'r' else 'left'
      return f'<Wrap align="{direc}">{translate(elem.children)}</Wrap>'
    elif elem.name == 'itemize':
      children = "\n".join([
        f'<li>{translate_one(child)}</li>'
        for child in elem.children
      ])
      return f'<ul>\n{children}</ul>'
    elif elem.name == '$':
      return f'<$>{{r`{elem.string}`}}</$>'
    else:
      raise Exception("env", type(elem), elem.name)
  else:
    raise Exception(type(elem), elem.name)

def translate(tex, delimiter=' '):
  return delimiter.join(filter(lambda s: s != '', [translate_one(elem) for elem in tex]))

patterns = [
  (r"\\(rust|Verb|rustfoot)\|([^|]*)\|", r"<C>\2</C>"),
  (r"``|''", r'"'),
]

for (pattern, subst) in patterns:
  stdin = re.sub(pattern, subst, stdin)

print(translate(TexSoup(stdin).expr.all))