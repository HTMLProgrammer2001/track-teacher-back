import {Injectable} from '@nestjs/common';
import {InternshipGetListRequest} from '../types/request/internship-get-list.request';
import {InternshipGetRepoRequest} from '../../../data-layer/repositories/internship/repo-request/internship-get.repo-request';
import {IPaginator} from '../../../global/types/interface/IPaginator.interface';
import {InternshipDbModel} from '../../../data-layer/db-models/internship.db-model';
import {InternshipResponse} from '../types/response/internship.response';
import {InternshipGetByIdRequest} from '../types/request/internship-get-by-id.request';
import {InternshipCreateRequest} from '../types/request/internship-create.request';
import {InternshipCreateRepoRequest} from '../../../data-layer/repositories/internship/repo-request/internship-create.repo-request';
import {UserGetRepoRequest} from '../../../data-layer/repositories/user/repo-request/user-get.repo-request';
import {UserSelectFieldsEnum} from '../../../data-layer/repositories/user/enums/user-select-fields.enum';
import {InternshipDeleteRepoRequest} from '../../../data-layer/repositories/internship/repo-request/internship-delete.repo-request';
import {InternshipUpdateRequest} from '../types/request/internship-update.request';
import {InternshipUpdateRepoRequest} from '../../../data-layer/repositories/internship/repo-request/internship-update.repo-request';

@Injectable()
export class InternshipMapper {
  getInternshipListRequestToRepoRequest(source: InternshipGetListRequest): InternshipGetRepoRequest {
    const destination = new InternshipGetRepoRequest();

    destination.title = source.title;
    destination.code = source.code;
    destination.place = source.place;
    destination.dateFromMore = source.dateFromMore;
    destination.dateToLess = source.dateToLess;
    destination.userId = source.userId;
    destination.showDeleted = source.showDeleted;
    destination.orderField = source.orderField;
    destination.isDesc = !!source.isDesc;
    destination.select = [...source.select];
    destination.page = source.page;
    destination.size = source.size;

    return destination;
  }

  internshipPaginatorDbModelToResponse(source: IPaginator<InternshipDbModel>): IPaginator<InternshipResponse> {
    return {
      ...source,
      responseList: source.responseList.map(el => this.internshipDbModelToResponse(el))
    };
  }

  internshipDbModelToResponse(source: InternshipDbModel): InternshipResponse {
    const destination = new InternshipResponse();

    destination.id = source.id;
    destination.title = source.title;
    destination.code = source.code;
    destination.description = source.description;
    destination.place = source.place;
    destination.hours = source.hours;
    destination.credits = source.credits;
    destination.from = source.from?.toISOString().split('T')[0];
    destination.to = source.to?.toISOString().split('T')[0];
    destination.isDeleted = source.isDeleted;
    destination.guid = source.guid;

    if (source.user) {
      destination.user = {
        id: source.user.id,
        name: source.user.fullName
      };
    }

    return destination;
  }

  getInternshipByIdRequestToRepoRequest(source: InternshipGetByIdRequest): InternshipGetRepoRequest {
    const destination = new InternshipGetRepoRequest();

    destination.id = source.id;
    destination.select = source.select;
    destination.showDeleted = source.showDeleted;
    destination.page = 1;
    destination.size = 1;

    return destination;
  }

  initializeGetInternshipByIdRepoRequest(id: number, select: Array<string>): InternshipGetRepoRequest {
    const destination = new InternshipGetRepoRequest();

    destination.id = id;
    destination.select = select;
    destination.showDeleted = true;
    destination.page = 1;
    destination.size = 1;

    return destination;
  }

  createInternshipRequestToRepoRequest(source: InternshipCreateRequest): InternshipCreateRepoRequest {
    const destination = new InternshipCreateRepoRequest();

    destination.userId = source.userId;
    destination.description = source.description;
    destination.title = source.title;
    destination.code = source.code;
    destination.place = source.place;
    destination.hours = source.hours;
    destination.credits = source.credits;
    destination.from = source.from;
    destination.to = source.to;

    return destination;
  }

  initializeGetUserRepoRequest(userId: number): UserGetRepoRequest {
    const destination = new UserGetRepoRequest();

    destination.id = userId;
    destination.select = [UserSelectFieldsEnum.ID, UserSelectFieldsEnum.IS_DELETED];
    destination.showDeleted = true;

    return destination;
  }

  updateInternshipRequestToRepoRequest(source: InternshipUpdateRequest): InternshipUpdateRepoRequest {
    const destination = new InternshipUpdateRepoRequest();

    destination.id = source.id;
    destination.userId = source.userId;
    destination.description = source.description;
    destination.title = source.title;
    destination.code = source.code;
    destination.place = source.place;
    destination.hours = source.hours;
    destination.credits = source.credits;
    destination.from = source.from;
    destination.to = source.to;

    return destination;
  }

  deleteInternshipRequestToRepoRequest(id: number): InternshipDeleteRepoRequest {
    const destination = new InternshipDeleteRepoRequest();

    destination.id = id;

    return destination;
  }
}