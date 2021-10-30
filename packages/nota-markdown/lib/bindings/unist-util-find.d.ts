declare module "unist-util-find" {
  import {Node} from "unist";
  export default function find(
    tree: Node,
    condition: string | object | ((node: Node) => boolean)
  ): Node | undefined;
}
