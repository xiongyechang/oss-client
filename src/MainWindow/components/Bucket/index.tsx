import React, { useEffect, useState } from "react";
import FileDrop from "react-file-drop";
import { ipcRenderer, remote } from "electron";

import "./index.scss";
import HeaderToolbar from "./HeaderToolbar";
import BodyTable from "./BodyTable";
import { Layout } from "../../types";
import BodyGrid from "./BodyGrid";
import Footer from "./Footer";
import HeaderButtonGroup from "./HeaderButtonGroup";
import VFolder from "../../lib/vdir/VFolder";
import { BucketObj, switchBucket } from "../../ipc";
import { qiniuAdapter } from "../../lib/adapter/qiniu";
import { Item } from "../../lib/vdir/types";
import VFile from "../../lib/vdir/VFile";
import { fileContextMenu } from "../../helper/contextMenu";

type PropTypes = {
  bucket: string;
  onLoadedBucket: () => void;
};

const Bucket = ({ bucket, onLoadedBucket }: PropTypes) => {
  const [vFolder, setVFolder] = useState<VFolder>(new VFolder("root"));
  const [layout, setLayout] = useState<Layout>(Layout.grid);
  const [domains, setDomains] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [searchedItem, setSearchedItem] = useState<Item[]>([]);
  const [searchValue, setSearchValue] = useState<string>("");

  const displayBucketFiles = (bucketObj: BucketObj) => {
    const adaptedFiles = qiniuAdapter(bucketObj.files);
    const vf = VFolder.from(adaptedFiles);
    onLoadedBucket();
    setVFolder(vf);
    setItems(vf.listFiles());
    setDomains(bucketObj.domains);
  };

  useEffect(() => {
    if (!bucket) return;
    switchBucket(bucket).then(bucketObj => displayBucketFiles(bucketObj));
  }, [bucket]);

  const fileUpload = () => {
    const userPath = remote.app.getPath("documents");
    remote.dialog
      .showOpenDialog({
        defaultPath: userPath,
        properties: ["openFile"]
      })
      .then(result => {
        if (!result.canceled) {
          result.filePaths.forEach(filPath => {
            ipcRenderer.send(
              "req:file:upload",
              vFolder.getPathPrefix(),
              filPath
            );
          });
        }
      })
      .catch(() => {});
  };
  const backspace = () => {
    vFolder.back();
    setItems(vFolder.listFiles());
  };
  const onFileDrop = (files: FileList | null) => {
    if (files) {
      const filePaths: string[] = [];
      for (let i = 0; i < files.length; i += 1) {
        filePaths.push(files[i].path);
      }
      ipcRenderer.send("drop-files", vFolder.getPathPrefix(), filePaths);
    }
  };
  const onFileContextMenu = (item: VFile) => {
    fileContextMenu(item, domains[0]);
  };
  const onFolderSelect = (name: string) => {
    vFolder.changeDir(name);
    setItems(vFolder.listFiles());
  };
  const onFolderContextMenu = (item: VFolder) => {};
  const onSearchChange = (value: string) => {
    setSearchValue(value);
    const it = vFolder.listFiles().filter(i => i.name.indexOf(value) >= 0);
    setSearchedItem(it);
  };
  const onChangeLayout = () => {
    setLayout(layout === Layout.grid ? Layout.table : Layout.grid);
  };
  const onRefreshBucket = () => {
    switchBucket(bucket).then(bucketObj => displayBucketFiles(bucketObj));
  };

  return (
    <div className="bucket-wrapper">
      <HeaderButtonGroup fileUpload={fileUpload} />
      <HeaderToolbar
        onRefreshBucket={onRefreshBucket}
        onSearchChange={onSearchChange}
        backspace={backspace}
        layout={layout}
        onChangeLayout={onChangeLayout}
        navigators={vFolder.getNav()}
      />
      {bucket ? (
        <div className="content-wrapper">
          <FileDrop onDrop={onFileDrop} />
          {Layout.grid === layout ? (
            <BodyGrid
              domains={domains}
              items={searchValue ? searchedItem : items}
              onFolderSelect={onFolderSelect}
              onFolderContextMenu={onFolderContextMenu}
              onFileSelect={() => {}}
              onFileContextMenu={onFileContextMenu}
            />
          ) : (
            <BodyTable
              items={searchValue ? searchedItem : items}
              onFolderSelect={onFolderSelect}
              onFolderContextMenu={onFolderContextMenu}
              onFileSelect={() => {}}
              onFileContextMenu={onFileContextMenu}
            />
          )}
        </div>
      ) : (
        <div className="content-wrapper">
          <div className="no-files">
            <div className="title">没有选中</div>
            <div className="sub-title">当前没有选中 bucket</div>
          </div>
        </div>
      )}
      <Footer
        totalItem={vFolder.getTotalItem()}
        selectedItem={0}
        domains={domains}
      />
    </div>
  );
};

export default Bucket;
