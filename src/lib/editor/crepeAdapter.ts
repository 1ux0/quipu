import { Crepe } from "@milkdown/crepe";
import { insert } from "@milkdown/kit/utils";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import type { EditorAdapter } from "./types";

export const crepeAdapter: EditorAdapter = {
  async create({ root, defaultValue, placeholder, onChange, onUploadImage }) {
    const upload = (file: File) => onUploadImage(file);
    const crepe = new Crepe({
      root,
      defaultValue,
      featureConfigs: {
        [Crepe.Feature.Placeholder]: { text: placeholder ?? "", mode: "doc" },
        [Crepe.Feature.ImageBlock]: {
          onUpload: upload,
          blockOnUpload: upload,
          inlineOnUpload: upload,
        },
      },
    });
    await crepe.create();
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => onChange(markdown));
    });
    return {
      getMarkdown: () => crepe.getMarkdown(),
      insertImage: (url) => crepe.editor.action(insert(`![](${url})`)),
      destroy: () => {
        crepe.destroy();
      },
    };
  },
};
