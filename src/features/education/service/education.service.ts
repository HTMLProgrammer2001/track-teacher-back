import {Injectable, Logger} from '@nestjs/common';
import {isNil} from 'lodash';
import {IPaginator} from '../../../global/types/interface/IPaginator.interface';
import {CustomError} from '../../../global/class/custom-error';
import {ErrorCodesEnum} from '../../../global/constants/error-codes.enum';
import {IdResponse} from '../../../global/types/response/id.response';
import {UserRepository} from '../../../data-layer/repositories/user/user.repository';
import {EducationRepository} from '../../../data-layer/repositories/education/education.repository';
import {EducationQualificationRepository} from '../../../data-layer/repositories/education-qualification/education-qualification.repository';
import {EducationMapper} from '../mapper/education.mapper';
import {EducationGetListRequest} from '../types/request/education-get-list.request';
import {EducationResponse} from '../types/response/education.response';
import {EducationGetByIdRequest} from '../types/request/education-get-by-id.request';
import {EducationCreateRequest} from '../types/request/education-create.request';
import {EducationUpdateRequest} from '../types/request/education-update.request';
import {EducationSelectFieldsEnum} from '../../../data-layer/repositories/education/enums/education-select-fields.enum';

@Injectable()
export class EducationService {
  private logger: Logger;

  constructor(
    private educationRepository: EducationRepository,
    private userRepository: UserRepository,
    private educationQualificationRepository: EducationQualificationRepository,
    private educationMapper: EducationMapper,
  ) {
    this.logger = new Logger(EducationService.name);
  }

  async getEducationList(request: EducationGetListRequest): Promise<IPaginator<EducationResponse>> {
    try {
      const repoRequest = this.educationMapper.getRebukeListRequestToRepoRequest(request);
      const {data} = await this.educationRepository.getEducation(repoRequest);
      return this.educationMapper.educationPaginatorDbModelToResponse(data);
    } catch (e) {
      if (!(e instanceof CustomError)) {
        this.logger.error(e);
        throw new CustomError({code: ErrorCodesEnum.GENERAL, message: e.message});
      }

      throw e;
    }
  }

  async getEducationById(request: EducationGetByIdRequest): Promise<EducationResponse> {
    try {
      const repoRequest = this.educationMapper.getEducationByIdRequestToRepoRequest(request);
      const {data} = await this.educationRepository.getEducation(repoRequest);

      if (data.responseList?.length) {
        return this.educationMapper.educationDbModelToResponse(data.responseList[0]);
      } else {
        throw new CustomError({code: ErrorCodesEnum.NOT_FOUND, message: `Education with id ${request.id} not exist`});
      }
    } catch (e) {
      if (!(e instanceof CustomError)) {
        this.logger.error(e);
        throw new CustomError({code: ErrorCodesEnum.GENERAL, message: e.message});
      }

      throw e;
    }
  }

  async createEducation(request: EducationCreateRequest): Promise<EducationResponse> {
    try {
      await this.validateRequest(request);

      const createRepoRequest = this.educationMapper.createEducationRequestToRepoRequest(request);
      const {createdID} = await this.educationRepository.createEducation(createRepoRequest);

      const repoRequest = this.educationMapper.initializeGetEducationByIdRepoRequest(createdID, request.select);
      const {data} = await this.educationRepository.getEducation(repoRequest);
      return this.educationMapper.educationDbModelToResponse(data.responseList[0]);
    } catch (e) {
      if (!(e instanceof CustomError)) {
        this.logger.error(e);
        throw new CustomError({code: ErrorCodesEnum.GENERAL, message: e.message});
      }

      throw e;
    }
  }

  async updateEducation(request: EducationUpdateRequest): Promise<EducationResponse> {
    try {
      const getCurrentEducationRepoRequest = this.educationMapper.initializeGetEducationByIdRepoRequest(
        request.id,
        [EducationSelectFieldsEnum.GUID, EducationSelectFieldsEnum.IS_DELETED]
      );
      const currentEducation = await this.educationRepository.getEducation(getCurrentEducationRepoRequest);

      if (!currentEducation.data.responseList?.length) {
        throw new CustomError({code: ErrorCodesEnum.NOT_FOUND, message: `Education with id ${request.id} not exist`});
      } else if (currentEducation.data.responseList[0].isDeleted) {
        throw new CustomError({
          code: ErrorCodesEnum.ALREADY_DELETED,
          message: `Education with id ${request.id} is deleted`
        });
      } else if (currentEducation.data.responseList[0].guid !== request.guid) {
        throw new CustomError({code: ErrorCodesEnum.GUID_CHANGED, message: 'Education guid was changed'});
      }

      await this.validateRequest(request);

      const updateRepoRequest = this.educationMapper.updateEducationRequestToRepoRequest(request);
      const {updatedID} = await this.educationRepository.updateEducation(updateRepoRequest);

      const repoRequest = this.educationMapper.initializeGetEducationByIdRepoRequest(updatedID, request.select);
      const {data} = await this.educationRepository.getEducation(repoRequest);
      return this.educationMapper.educationDbModelToResponse(data.responseList[0]);
    } catch (e) {
      if (!(e instanceof CustomError)) {
        this.logger.error(e);
        throw new CustomError({code: ErrorCodesEnum.GENERAL, message: e.message});
      }

      throw e;
    }
  }

  async deleteEducation(id: number, guid: string): Promise<IdResponse> {
    try {
      const getCurrentEducationRepoRequest = this.educationMapper.initializeGetEducationByIdRepoRequest(
        id,
        [EducationSelectFieldsEnum.GUID, EducationSelectFieldsEnum.IS_DELETED]
      );
      const currentEducation = await this.educationRepository.getEducation(getCurrentEducationRepoRequest);

      if (!currentEducation.data.responseList?.length) {
        throw new CustomError({code: ErrorCodesEnum.NOT_FOUND, message: `Education with id ${id} not exist`});
      } else if (currentEducation.data.responseList[0].isDeleted) {
        throw new CustomError({
          code: ErrorCodesEnum.ALREADY_DELETED,
          message: `Education with id ${id} already deleted`
        });
      } else if (currentEducation.data.responseList[0].guid !== guid) {
        throw new CustomError({code: ErrorCodesEnum.ALREADY_DELETED, message: `Education guid was changed`});
      }

      const deleteRepoRequest = this.educationMapper.deleteEducationRequestToRepoRequest(id);
      const {deletedID} = await this.educationRepository.deleteEducation(deleteRepoRequest);
      return {id: deletedID};
    } catch (e) {
      if (!(e instanceof CustomError)) {
        this.logger.error(e);
        throw new CustomError({code: ErrorCodesEnum.GENERAL, message: e.message});
      }

      throw e;
    }
  }

  async validateRequest(request: EducationCreateRequest) {
    //validate user
    if (!isNil(request.userId)) {
      const getUserRepoRequest = this.educationMapper.initializeGetUserRepoRequest(request.userId);
      const {data: userData} = await this.userRepository.getUsers(getUserRepoRequest);

      if (!userData.responseList.length) {
        throw new CustomError({
          code: ErrorCodesEnum.NOT_FOUND,
          message: `User with id ${request.userId} not found`
        });
      }

      if (userData.responseList[0].isDeleted) {
        throw new CustomError({
          code: ErrorCodesEnum.ALREADY_DELETED,
          message: `User with id ${request.userId} is deleted`
        });
      }
    }

    //validate education qualification
    if (!isNil(request.educationQualificationId)) {
      const getEducationQualificationRepoRequest = this.educationMapper
        .initializeGetEducationQualificationRepoRequest(request.educationQualificationId);

      const {data: educationQualificationData} = await this.educationQualificationRepository
        .getEducationQualification(getEducationQualificationRepoRequest);

      if (!educationQualificationData.responseList.length) {
        throw new CustomError({
          code: ErrorCodesEnum.NOT_FOUND,
          message: `Education qualification with id ${request.userId} not found`
        });
      }

      if (educationQualificationData.responseList[0].isDeleted) {
        throw new CustomError({
          code: ErrorCodesEnum.ALREADY_DELETED,
          message: `Education qualification with id ${request.userId} is deleted`
        });
      }
    }
  }
}
