import { config } from "dotenv";

import deleteAllNotJustTestData from "./functional/deleteAll";
import setup from "./functional/setup";
import api from "./remote/api";
import auth from "./remote/auth";
import uploader from "./remote/upload";

config();

setup(auth, uploader, api)
  .then((setupData: any) => {
    deleteAllNotJustTestData(setupData, setupData.api);
  });
