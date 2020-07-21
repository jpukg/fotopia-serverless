import { IQueryDBResponseItem } from ".";
import { IFaceWithPeople } from "./faces";
import {
  IImage,
} from "./images";
import { IPerson } from "./people";
import {
  IUpdateBody,
} from "./update";

export interface ILoggerBaseParams {
  id: string; // A unique ID for each span
  name: string; // The specific call location (like a function or method name)
  parentId: string;	// The ID of this span’s parent span, the call location the current span was called from
  startTime: number;
  traceId: string; // The ID of the trace this span belongs to
}

export interface ILoggerFacesParams {
  newImage: IImage;
  updateBody?: IUpdateBody;
  existingPeople?: IPerson[];
  facesWithPeople?: IFaceWithPeople[];
  updatedPeople?: IPerson[];
  newPeopleInThisImage?: IPerson[];
  newPeopleThatAreOkSize?: IPerson[];
}

export interface ILoggerImageParams {
  imageBirthtime: number;
  imageCreatedAt: number;
  imageFacesCount: number;
  imageFacesRaw?: string;
  imageFamilyGroup: string;
  imageHeight: number;
  imageId: string;
  imageKey: string;
  imageTagCount: number;
  imageUpdatedAt: number;
  imageUserIdentityId: string;
  imageUsername: string;
  imageWidth: number;
}

export interface ILoggerCreateParams extends ILoggerImageParams {
  createIdentifiedFacesCount: number;
  createIdentifiedLabelsCount: number;
  createPayloadTagCount: number;
  imageMetaRaw: string;
}

export interface ILoggerPeopleMergeParams {
  mergePeopleIds: string[];
  existingPeople: IPerson[];
  mergedPerson: IPerson;
  deletePeople: IPerson[];
  imagesWithAffectedPeople: IQueryDBResponseItem[];
  updatedPeople: IPerson[];
}
