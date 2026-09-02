/** API paths for the folder / prompt-file endpoints (relative to `/api`). */

export const folderApiPath = (folder: string) => "/folders/" + encodeURIComponent(folder);

export const promptApiPath = (folder: string, name: string) =>
  folderApiPath(folder) + "/prompts/" + encodeURIComponent(name);
