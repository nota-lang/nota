# Nota: A Web Framework for Academic Papers

Nota is a framework for writing academic papers, like LaTeX. It uses the browser's document layout engine and interactive capabilities to make papers easier to both write and read.

To see an example or read about Nota's design philosophy, please read my [HATRA '21](https://2021.splashcon.org/home/hatra-2021) paper: ["A New Medium for Communicating Research on Programming Languages"](https://willcrichton.net/nota/)

The core Nota framework is in [src](https://github.com/willcrichton/nota/tree/master/src). You can find examples of using Nota in [examples/slicing](https://github.com/willcrichton/nota/tree/master/examples/slicing) and [examples/hatra](https://github.com/willcrichton/nota/tree/master/examples/hatra). To build the HATRA paper, you can run:

```
git clone https://github.com/willcrichton/nota
cd nota
yarn && yarn build
cd examples/slicing
yarn && yarn build
cd ../hatra
yarn && yarn build
cd dist
python3 -m http.server
```

And then visit [http://localhost:8000/](http://localhost:8000/).