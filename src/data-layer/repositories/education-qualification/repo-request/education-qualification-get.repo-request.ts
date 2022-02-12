import {BaseRepoRequest} from '../../common/base-repo-request';

export class EducationQualificationGetRepoRequest extends BaseRepoRequest {
  page: number;
  size: number;
  id: number;
  ids: Array<number>;
  name: string;
  select: Array<string>;
  orderField: string;
  isDesc: boolean;
  showDeleted: boolean;
}
