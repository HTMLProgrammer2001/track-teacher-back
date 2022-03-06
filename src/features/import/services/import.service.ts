import {Injectable, Logger} from '@nestjs/common';
import {Workbook} from 'exceljs';
import {validate} from 'class-validator';
import {isNil, uniq} from 'lodash';
import * as bcrypt from 'bcrypt';
import {ConfigService} from '@nestjs/config';
import {ImportRequest} from '../types/request/import.request';
import {ImportErrorResponse, ImportResponse} from '../types/response/import.response';
import {ImportDataTypeEnum} from '../types/common/import-data-type.enum';
import {CustomError} from '../../../global/class/custom-error';
import {ErrorCodesEnum} from '../../../global/constants/error-codes.enum';
import {UserImportColumnsEnum} from '../types/common/columns/user-import-columns.enum';
import {UserImportData} from '../types/common/import-data/user-import-data';
import {RoleRepository} from '../../../data-layer/repositories/role/role.repository';
import {ImportMapper} from '../mapper/import.mapper';
import {UserDbModel} from '../../../data-layer/db-models/user.db-model';
import {RoleDbModel} from '../../../data-layer/db-models/role.db-model';
import {UserRepository} from '../../../data-layer/repositories/user/user.repository';
import {InternshipImportData} from '../types/common/import-data/internship-import-data';
import {InternshipImportColumnsEnum} from '../types/common/columns/internship-import-columns.enum';
import {isFilledWithData} from '../../../global/utils/functions';
import {InternshipDbModel} from '../../../data-layer/db-models/internship.db-model';
import {TeacherDbModel} from '../../../data-layer/db-models/teacher.db-model';
import {TeacherRepository} from '../../../data-layer/repositories/teacher/teacher.repository';
import {InternshipRepository} from '../../../data-layer/repositories/internship/internship.repository';
import {PublicationImportData} from '../types/common/import-data/publication-import-data';
import {PublicationImportColumnsEnum} from '../types/common/columns/publication-import-columns.enum';
import {PublicationRepository} from '../../../data-layer/repositories/publication/publication.repository';
import {HonorImportData} from '../types/common/import-data/honor-import-data';
import {HonorImportColumnsEnum} from '../types/common/columns/honor-import-columns.enum';
import {HonorDbModel} from '../../../data-layer/db-models/honor.db-model';
import {HonorRepository} from '../../../data-layer/repositories/honor/honor.repository';
import {RebukeRepository} from '../../../data-layer/repositories/rebuke/rebuke.repository';
import {RebukeImportData} from '../types/common/import-data/rebuke-import-data';
import {RebukeImportColumnsEnum} from '../types/common/columns/rebuke-import-columns.enum';
import {RebukeDbModel} from '../../../data-layer/db-models/rebuke.db-model';
import {EducationImportData} from '../types/common/import-data/education-import-data';
import {EducationImportColumnsEnum} from '../types/common/columns/education-import-columns.enum';
import {EducationQualificationDbModel} from '../../../data-layer/db-models/education-qualification.db-model';
import {EducationQualificationRepository} from '../../../data-layer/repositories/education-qualification/education-qualification.repository';
import {EducationRepository} from '../../../data-layer/repositories/education/education.repository';
import {AttestationRepository} from '../../../data-layer/repositories/attestation/attestation.repository';
import {CategoryRepository} from '../../../data-layer/repositories/category/category.repository';
import {AttestationImportData} from '../types/common/import-data/attestation-import-data';
import {AttestationImportColumnsEnum} from '../types/common/columns/attestation-import-columns.enum';
import {CategoryDbModel} from '../../../data-layer/db-models/category.db-model';

@Injectable()
export class ImportService {
  static START_ROW = 2;
  private logger: Logger;

  constructor(
    private configService: ConfigService,
    private importMapper: ImportMapper,
    private roleRepository: RoleRepository,
    private userRepository: UserRepository,
    private teacherRepository: TeacherRepository,
    private internshipRepository: InternshipRepository,
    private publicationRepository: PublicationRepository,
    private honorRepository: HonorRepository,
    private rebukeRepository: RebukeRepository,
    private educationQualificationRepository: EducationQualificationRepository,
    private educationRepository: EducationRepository,
    private attestationRepository: AttestationRepository,
    private categoryRepository: CategoryRepository,
  ) {
    this.logger = new Logger(ImportService.name);
  }

  async importData(request: ImportRequest): Promise<ImportResponse> {
    try {
      switch (request.type) {
        case ImportDataTypeEnum.USER:
          return this.importUsers(request);

        case ImportDataTypeEnum.INTERNSHIP:
          return this.importInternships(request);

        case ImportDataTypeEnum.PUBLICATION:
          return this.importPublications(request);

        case ImportDataTypeEnum.HONOR:
          return this.importHonors(request);

        case ImportDataTypeEnum.REBUKE:
          return this.importRebukes(request);

        case ImportDataTypeEnum.EDUCATION:
          return this.importEducations(request);

        case ImportDataTypeEnum.ATTESTATION:
          return this.importAttestations(request);

        default:
          throw new CustomError({code: ErrorCodesEnum.GENERAL, message: 'Unsupported type'});
      }
    } catch (e) {
      if (!(e instanceof CustomError)) {
        this.logger.error(e);
        throw new CustomError({code: ErrorCodesEnum.GENERAL, message: e.message});
      }

      throw e;
    }
  }

  async importUsers(request: ImportRequest): Promise<ImportResponse> {
    try {
      const workbook = new Workbook();
      const file = await request.file;
      const template = await workbook.xlsx.read(file.createReadStream());
      const worksheet = template.getWorksheet(1);

      const importErrors: Array<ImportErrorResponse> = [];
      let userImportDataArray: Array<UserImportData> = [];
      let startRow = request.from ?? ImportService.START_ROW;
      let currentRow = startRow;

      while (true) {
        const row = worksheet.getRow(currentRow);

        //read data from row
        const userImportData = new UserImportData();
        userImportData.fullName = String(row.getCell(UserImportColumnsEnum.FULL_NAME).value ?? '');
        userImportData.email = String(row.getCell(UserImportColumnsEnum.EMAIL).value ?? '');
        userImportData.phone = String(row.getCell(UserImportColumnsEnum.PHONE).value ?? '');
        userImportData.password = String(row.getCell(UserImportColumnsEnum.PASSWORD).value ?? '');
        userImportData.passwordHash = bcrypt.hashSync(userImportData.password, Number(this.configService.get('SALT')));
        if(row.getCell(UserImportColumnsEnum.ROLE).value) {
          userImportData.roleId = Number(row.getCell(UserImportColumnsEnum.ROLE).value.toString().split(' - ')[0]);
        }

        if((isNil(request.to) && !isFilledWithData(row)) || (!isNil(request.to) && currentRow <= request.to)) {
          break;
        }
        else {
          //data validation of row
          const validationErrors = await validate(userImportData);
          validationErrors.forEach(validationError => {
            Object.values(validationError.constraints).map(errorMessage => {
              importErrors.push({row: currentRow, property: validationError.property, message: errorMessage});
            });
          });

          //add row to import if valid
          if(!validationErrors.length) {
            userImportDataArray.push(userImportData);
          }

          currentRow++;
        }
      }

      if(!userImportDataArray.length && !importErrors.length) {
        importErrors.push({message: 'No data to import'});
      }

      //logic validation
      const uniqueEmails: Array<string> = [];
      const uniquePhones: Array<string> = [];
      const existRoles: Array<number> = [];

      userImportDataArray = userImportDataArray.filter((userImportData, index) => {
        if(uniqueEmails.includes(userImportData.email)) {
          importErrors.push({row: startRow + index, property: 'email', message: 'Email not unique in file'});
          return false;
        }
        else {
          uniqueEmails.push(userImportData.email);
        }

        if(userImportData.phone && uniquePhones.includes(userImportData.phone)) {
          importErrors.push({row: startRow + index, property: 'phone', message: 'Phone not unique in file'});
          return false;
        }
        else if (userImportData.phone) {
          uniquePhones.push(userImportData.phone);
        }

        existRoles.push(userImportData.roleId);
        return true;
      });

      //local file validation without database end
      if(!request.ignoreErrors && importErrors.length) {
        return {result: false, errors: importErrors};
      }

      //get data to validate unique
      let usersWithEmails: Array<UserDbModel> = [];
      let usersWithPhones: Array<UserDbModel> = [];
      let roles: Array<RoleDbModel> = [];

      if(existRoles.length) {
        const getRoleRequest = this.importMapper.initializeGetRolesByIds(uniq(existRoles));
        const roleResponse = await this.roleRepository.getRoles(getRoleRequest);
        roles = roleResponse.data.responseList;
      }

      if(uniqueEmails.length) {
        const getUsersByEmailsRequest = this.importMapper.initializeGetUsersByEmails(uniqueEmails);
        const usersWithEmailsResponse = await this.userRepository.getUsers(getUsersByEmailsRequest);
        usersWithEmails = usersWithEmailsResponse.data.responseList;
      }

      if(uniquePhones.length) {
        const getUsersByPhonesRequest = this.importMapper.initializeGetUsersByPhones(uniquePhones);
        const usersWithPhonesResponse = await this.userRepository.getUsers(getUsersByPhonesRequest);
        usersWithPhones = usersWithPhonesResponse.data.responseList;
      }

      userImportDataArray = userImportDataArray.filter((userImportData, index) => {
        if(usersWithEmails.find(user => user.email === userImportData.email)) {
          importErrors.push({
            row: startRow + index,
            property: 'email',
            message: `User with email ${userImportData.email} already exist`
          });

          return false;
        }

        if(userImportData.phone && usersWithPhones.find(user => user.phone === userImportData.phone)) {
          importErrors.push({
            row: startRow + index,
            property: 'phone',
            message: `User with phone ${userImportData.phone} already exist`
          });

          return false;
        }

        if(!roles.find(role => role.id === userImportData.roleId)) {
          importErrors.push({
            row: startRow + index,
            property: 'role',
            message: `Role with id ${userImportData.roleId} not exist`
          });

          return false;
        }

        return true;
      });

      await this.userRepository.import(userImportDataArray, request.ignoreErrors);
      return {result: request.ignoreErrors ? true : !importErrors.length, errors: importErrors};
    } catch (e) {
      if (!(e instanceof CustomError)) {
        this.logger.error(e);
        throw new CustomError({code: ErrorCodesEnum.GENERAL, message: e.message});
      }

      throw e;
    }
  }

  async importInternships(request: ImportRequest): Promise<ImportResponse> {
    try {
      const workbook = new Workbook();
      const file = await request.file;
      const template = await workbook.xlsx.read(file.createReadStream());
      const worksheet = template.getWorksheet(1);

      const importErrors: Array<ImportErrorResponse> = [];
      let internshipImportDataArray: Array<InternshipImportData> = [];
      let startRow = request.from ?? ImportService.START_ROW;
      let currentRow = startRow;

      while (true) {
        const row = worksheet.getRow(currentRow);

        //read data from row
        const internshipImportData = new InternshipImportData();

        if(row.getCell(InternshipImportColumnsEnum.TEACHER).value) {
          internshipImportData.teacherId = Number(row.getCell(InternshipImportColumnsEnum.TEACHER).value.toString().split(' - ')[0]);
        }

        internshipImportData.title = String(row.getCell(InternshipImportColumnsEnum.TITLE).value ?? '');
        internshipImportData.code = String(row.getCell(InternshipImportColumnsEnum.CODE).value ?? '');

        if(row.getCell(InternshipImportColumnsEnum.DESCRIPTION).value) {
          internshipImportData.description = String(row.getCell(InternshipImportColumnsEnum.DESCRIPTION).value ?? '');
        }

        if(row.getCell(InternshipImportColumnsEnum.PLACE).value) {
          internshipImportData.place = String(row.getCell(InternshipImportColumnsEnum.PLACE).value ?? '');
        }

        if(row.getCell(InternshipImportColumnsEnum.FROM).value){
          internshipImportData.from = new Date(String(row.getCell(InternshipImportColumnsEnum.FROM).value ?? ''));
        }

        if(row.getCell(InternshipImportColumnsEnum.TO).value){
          internshipImportData.to = new Date(String(row.getCell(InternshipImportColumnsEnum.TO).value ?? ''));
        }

        internshipImportData.isToMoreThanFrom = internshipImportData.from && internshipImportData.to
          && internshipImportData.to >= internshipImportData.from;


        if(row.getCell(InternshipImportColumnsEnum.HOURS).value) {
          internshipImportData.hours = Number(row.getCell(InternshipImportColumnsEnum.HOURS).value ?? 0);
        }

        if(row.getCell(InternshipImportColumnsEnum.CREDITS).value) {
          internshipImportData.credits = Number(row.getCell(InternshipImportColumnsEnum.CREDITS).value ?? 0);
        }

        if((isNil(request.to) && !isFilledWithData(row)) || (!isNil(request.to) && currentRow <= request.to)) {
          break;
        }
        else {
          //data validation of row
          const validationErrors = await validate(internshipImportData);
          validationErrors.forEach(validationError => {
            Object.values(validationError.constraints).map(errorMessage => {
              importErrors.push({row: currentRow, property: validationError.property, message: errorMessage});
            });
          });

          //add row to import if valid
          if(!validationErrors.length) {
            internshipImportDataArray.push(internshipImportData);
          }

          currentRow++;
        }
      }

      if(!internshipImportDataArray.length && !importErrors.length) {
        importErrors.push({message: 'No data to import'});
      }

      //logic validation
      const uniqueCodes: Array<string> = [];
      const existTeachers: Array<number> = [];

      internshipImportDataArray = internshipImportDataArray.filter((internshipImportData, index) => {
        if(uniqueCodes.includes(internshipImportData.code)) {
          importErrors.push({row: startRow + index, property: 'code', message: 'Code not unique in file'});
          return false;
        }
        else {
          uniqueCodes.push(internshipImportData.code);
        }

        existTeachers.push(internshipImportData.teacherId);
        return true;
      });

      //local file validation without database end
      if(!request.ignoreErrors && importErrors.length) {
        return {result: false, errors: importErrors};
      }

      //get data to validate unique
      let internshipsWithCodes: Array<InternshipDbModel> = [];
      let teachers: Array<TeacherDbModel> = [];

      if(existTeachers.length) {
        const getTeachersRequest = this.importMapper.initializeGetTeachersByIds(uniq(existTeachers));
        const teacherResponse = await this.teacherRepository.getTeachers(getTeachersRequest);
        teachers = teacherResponse.data.responseList;
      }

      if(uniqueCodes.length) {
        const getInternshipsByEmailsRequest = this.importMapper.initializeGetInternshipsByCodes(uniqueCodes);
        const internshipsWithCodesResponse = await this.internshipRepository.getInternships(getInternshipsByEmailsRequest);
        internshipsWithCodes = internshipsWithCodesResponse.data.responseList;
      }

      internshipImportDataArray = internshipImportDataArray.filter((internshipImportData, index) => {
        if(internshipsWithCodes.find(internship => internship.code === internshipImportData.code)) {
          importErrors.push({
            row: startRow + index,
            property: 'code',
            message: `Internship with code ${internshipImportData.code} already exist`
          });

          return false;
        }

        if(!teachers.find(teacher => teacher.id === internshipImportData.teacherId)) {
          importErrors.push({
            row: startRow + index,
            property: 'teacher',
            message: `Teacher with id ${internshipImportData.teacherId} not exist`
          });

          return false;
        }

        return true;
      });

      await this.internshipRepository.import(internshipImportDataArray, request.ignoreErrors);
      return {result: request.ignoreErrors ? true : !importErrors.length, errors: importErrors};
    } catch (e) {
      if (!(e instanceof CustomError)) {
        this.logger.error(e);
        throw new CustomError({code: ErrorCodesEnum.GENERAL, message: e.message});
      }

      throw e;
    }
  }

  async importPublications(request: ImportRequest): Promise<ImportResponse> {
    try {
      const workbook = new Workbook();
      const file = await request.file;
      const template = await workbook.xlsx.read(file.createReadStream());
      const worksheet = template.getWorksheet(1);

      const importErrors: Array<ImportErrorResponse> = [];
      let publicationImportDataArray: Array<PublicationImportData> = [];
      let startRow = request.from ?? ImportService.START_ROW;
      let currentRow = startRow;

      while (true) {
        const row = worksheet.getRow(currentRow);

        //read data from row
        const publicationImportData = new PublicationImportData();
        publicationImportData.title = String(row.getCell(PublicationImportColumnsEnum.TITLE).value ?? '');
        publicationImportData.date = new Date(String(row.getCell(PublicationImportColumnsEnum.DATE).value ?? ''));

        if(row.getCell(PublicationImportColumnsEnum.PUBLISHER).value) {
          publicationImportData.publisher = String(row.getCell(PublicationImportColumnsEnum.PUBLISHER).value ?? '');
        }

        if(row.getCell(PublicationImportColumnsEnum.URL).value) {
          publicationImportData.url = String(row.getCell(PublicationImportColumnsEnum.URL).value ?? '');
        }

        if(row.getCell(PublicationImportColumnsEnum.ANOTHER_AUTHORS).value) {
          publicationImportData.anotherAuthors = String(row.getCell(PublicationImportColumnsEnum.ANOTHER_AUTHORS).value ?? '');
        }

        if(row.getCell(PublicationImportColumnsEnum.DESCRIPTION).value) {
          publicationImportData.description = String(row.getCell(PublicationImportColumnsEnum.DESCRIPTION).value ?? '');
        }

        if(row.getCell(PublicationImportColumnsEnum.TEACHERS).value) {
           publicationImportData.teacherIds = row.getCell(PublicationImportColumnsEnum.TEACHERS).value
             .toString().split('\n').map(el => Number(el.split(' - ')[0]));
        }

        if((isNil(request.to) && !isFilledWithData(row)) || (!isNil(request.to) && currentRow <= request.to)) {
          break;
        }
        else {
          //data validation of row
          const validationErrors = await validate(publicationImportData);
          validationErrors.forEach(validationError => {
            Object.values(validationError.constraints).map(errorMessage => {
              importErrors.push({row: currentRow, property: validationError.property, message: errorMessage});
            });
          });

          //add row to import if valid
          if(!validationErrors.length) {
            publicationImportDataArray.push(publicationImportData);
          }

          currentRow++;
        }
      }

      if(!publicationImportDataArray.length && !importErrors.length) {
        importErrors.push({message: 'No data to import'});
      }

      //logic validation
      let existTeachers: Array<number> = [];

      publicationImportDataArray = publicationImportDataArray.filter(publicationImportData => {
        existTeachers = existTeachers.concat(publicationImportData.teacherIds);
        return true;
      });

      //local file validation without database end
      if(!request.ignoreErrors && importErrors.length) {
        return {result: false, errors: importErrors};
      }

      //get data to validate unique
      let teachers: Array<TeacherDbModel> = [];

      if(existTeachers.length) {
        const getTeachersRequest = this.importMapper.initializeGetTeachersByIds(uniq(existTeachers));
        const teacherResponse = await this.teacherRepository.getTeachers(getTeachersRequest);
        teachers = teacherResponse.data.responseList;
      }

      publicationImportDataArray = publicationImportDataArray.filter((publicationImportData, index) => {
        const notExistIds = publicationImportData.teacherIds.filter(teacherId => {
          return !teachers.find(teacher => teacher.id === teacherId);
        });

        if(notExistIds.length) {
          importErrors.push({
            row: startRow + index,
            property: 'teachers',
            message: `Teachers with ids ${notExistIds.join(', ')} not exist`
          });

          return false;
        }

        return true;
      });

      await this.publicationRepository.import(publicationImportDataArray, request.ignoreErrors);
      return {result: request.ignoreErrors ? true : !importErrors.length, errors: importErrors};
    } catch (e) {
      if (!(e instanceof CustomError)) {
        this.logger.error(e);
        throw new CustomError({code: ErrorCodesEnum.GENERAL, message: e.message});
      }

      throw e;
    }
  }

  async importHonors(request: ImportRequest): Promise<ImportResponse> {
    try {
      const workbook = new Workbook();
      const file = await request.file;
      const template = await workbook.xlsx.read(file.createReadStream());
      const worksheet = template.getWorksheet(1);

      const importErrors: Array<ImportErrorResponse> = [];
      let honorImportDataArray: Array<HonorImportData> = [];
      let startRow = request.from ?? ImportService.START_ROW;
      let currentRow = startRow;

      while (true) {
        const row = worksheet.getRow(currentRow);

        //read data from row
        const honorImportData = new HonorImportData();

        if(row.getCell(HonorImportColumnsEnum.TEACHER).value) {
          honorImportData.teacherId = Number(row.getCell(HonorImportColumnsEnum.TEACHER).value.toString().split(' - ')[0]);
        }

        honorImportData.title = String(row.getCell(HonorImportColumnsEnum.TITLE).value ?? '');
        honorImportData.orderNumber = String(row.getCell(HonorImportColumnsEnum.ORDER_NUMBER).value ?? '');
        honorImportData.isActive = row.getCell(HonorImportColumnsEnum.IS_NOT_ACTIVE).value === 'no';

        if(row.getCell(HonorImportColumnsEnum.DATE).value){
          honorImportData.date = new Date(String(row.getCell(HonorImportColumnsEnum.DATE).value ?? ''));
        }

        if(row.getCell(InternshipImportColumnsEnum.DESCRIPTION).value) {
          honorImportData.description = String(row.getCell(InternshipImportColumnsEnum.DESCRIPTION).value ?? '');
        }

        if((isNil(request.to) && !isFilledWithData(row)) || (!isNil(request.to) && currentRow <= request.to)) {
          break;
        }
        else {
          //data validation of row
          const validationErrors = await validate(honorImportData);
          validationErrors.forEach(validationError => {
            Object.values(validationError.constraints).map(errorMessage => {
              importErrors.push({row: currentRow, property: validationError.property, message: errorMessage});
            });
          });

          //add row to import if valid
          if(!validationErrors.length) {
            honorImportDataArray.push(honorImportData);
          }

          currentRow++;
        }
      }

      if(!honorImportDataArray.length && !importErrors.length) {
        importErrors.push({message: 'No data to import'});
      }

      //logic validation
      const uniqueOrderNumbers: Array<string> = [];
      const existTeachers: Array<number> = [];

      honorImportDataArray = honorImportDataArray.filter((honorImportData, index) => {
        if(uniqueOrderNumbers.includes(honorImportData.orderNumber)) {
          importErrors.push({row: startRow + index, property: 'orderNumber', message: 'Order number not unique in file'});
          return false;
        }
        else {
          uniqueOrderNumbers.push(honorImportData.orderNumber);
        }

        existTeachers.push(honorImportData.teacherId);
        return true;
      });

      //local file validation without database end
      if(!request.ignoreErrors && importErrors.length) {
        return {result: false, errors: importErrors};
      }

      //get data to validate unique
      let honorsWithOrderNumbers: Array<HonorDbModel> = [];
      let teachers: Array<TeacherDbModel> = [];

      if(existTeachers.length) {
        const getTeachersRequest = this.importMapper.initializeGetTeachersByIds(uniq(existTeachers));
        const teacherResponse = await this.teacherRepository.getTeachers(getTeachersRequest);
        teachers = teacherResponse.data.responseList;
      }

      if(uniqueOrderNumbers.length) {
        const getHonorsByOrderNumbersRequest = this.importMapper.initializeGetHonorsByOrderNumbers(uniqueOrderNumbers);
        const honorsWithOrderNumbersResponse = await this.honorRepository.getHonors(getHonorsByOrderNumbersRequest);
        honorsWithOrderNumbers = honorsWithOrderNumbersResponse.data.responseList;
      }

      honorImportDataArray = honorImportDataArray.filter((honorImportData, index) => {
        if(honorsWithOrderNumbers.find(internship => internship.orderNumber === honorImportData.orderNumber)) {
          importErrors.push({
            row: startRow + index,
            property: 'orderNumber',
            message: `Honor with order number ${honorImportData.orderNumber} already exist`
          });

          return false;
        }

        if(!teachers.find(teacher => teacher.id === honorImportData.teacherId)) {
          importErrors.push({
            row: startRow + index,
            property: 'teacher',
            message: `Teacher with id ${honorImportData.teacherId} not exist`
          });

          return false;
        }

        return true;
      });

      await this.honorRepository.import(honorImportDataArray, request.ignoreErrors);
      return {result: request.ignoreErrors ? true : !importErrors.length, errors: importErrors};
    } catch (e) {
      if (!(e instanceof CustomError)) {
        this.logger.error(e);
        throw new CustomError({code: ErrorCodesEnum.GENERAL, message: e.message});
      }

      throw e;
    }
  }

  async importRebukes(request: ImportRequest): Promise<ImportResponse> {
    try {
      const workbook = new Workbook();
      const file = await request.file;
      const template = await workbook.xlsx.read(file.createReadStream());
      const worksheet = template.getWorksheet(1);

      const importErrors: Array<ImportErrorResponse> = [];
      let rebukeImportDataArray: Array<RebukeImportData> = [];
      let startRow = request.from ?? ImportService.START_ROW;
      let currentRow = startRow;

      while (true) {
        const row = worksheet.getRow(currentRow);

        //read data from row
        const rebukeImportData = new RebukeImportData();

        if(row.getCell(RebukeImportColumnsEnum.TEACHER).value) {
          rebukeImportData.teacherId = Number(row.getCell(RebukeImportColumnsEnum.TEACHER).value.toString().split(' - ')[0]);
        }

        rebukeImportData.title = String(row.getCell(RebukeImportColumnsEnum.TITLE).value ?? '');
        rebukeImportData.orderNumber = String(row.getCell(RebukeImportColumnsEnum.ORDER_NUMBER).value ?? '');
        rebukeImportData.isActive = row.getCell(RebukeImportColumnsEnum.IS_NOT_ACTIVE).value === 'no';

        if(row.getCell(RebukeImportColumnsEnum.DATE).value){
          rebukeImportData.date = new Date(String(row.getCell(RebukeImportColumnsEnum.DATE).value ?? ''));
        }

        if(row.getCell(RebukeImportColumnsEnum.DESCRIPTION).value) {
          rebukeImportData.description = String(row.getCell(RebukeImportColumnsEnum.DESCRIPTION).value ?? '');
        }

        if((isNil(request.to) && !isFilledWithData(row)) || (!isNil(request.to) && currentRow <= request.to)) {
          break;
        }
        else {
          //data validation of row
          const validationErrors = await validate(rebukeImportData);
          validationErrors.forEach(validationError => {
            Object.values(validationError.constraints).map(errorMessage => {
              importErrors.push({row: currentRow, property: validationError.property, message: errorMessage});
            });
          });

          //add row to import if valid
          if(!validationErrors.length) {
            rebukeImportDataArray.push(rebukeImportData);
          }

          currentRow++;
        }
      }

      if(!rebukeImportDataArray.length && !importErrors.length) {
        importErrors.push({message: 'No data to import'});
      }

      //logic validation
      const uniqueOrderNumbers: Array<string> = [];
      const existTeachers: Array<number> = [];

      rebukeImportDataArray = rebukeImportDataArray.filter((rebukeImportData, index) => {
        if(uniqueOrderNumbers.includes(rebukeImportData.orderNumber)) {
          importErrors.push({row: startRow + index, property: 'orderNumber', message: 'Order number not unique in file'});
          return false;
        }
        else {
          uniqueOrderNumbers.push(rebukeImportData.orderNumber);
        }

        existTeachers.push(rebukeImportData.teacherId);
        return true;
      });

      //local file validation without database end
      if(!request.ignoreErrors && importErrors.length) {
        return {result: false, errors: importErrors};
      }

      //get data to validate unique
      let rebukesWithOrderNumbers: Array<RebukeDbModel> = [];
      let teachers: Array<TeacherDbModel> = [];

      if(existTeachers.length) {
        const getTeachersRequest = this.importMapper.initializeGetTeachersByIds(uniq(existTeachers));
        const teacherResponse = await this.teacherRepository.getTeachers(getTeachersRequest);
        teachers = teacherResponse.data.responseList;
      }

      if(uniqueOrderNumbers.length) {
        const getRebukesByOrderNumbersRequest = this.importMapper.initializeGetRebukesByOrderNumbers(uniqueOrderNumbers);
        const rebukesWithOrderNumbersResponse = await this.rebukeRepository.getRebukes(getRebukesByOrderNumbersRequest);
        rebukesWithOrderNumbers = rebukesWithOrderNumbersResponse.data.responseList;
      }

      rebukeImportDataArray = rebukeImportDataArray.filter((honorImportData, index) => {
        if(rebukesWithOrderNumbers.find(internship => internship.orderNumber === honorImportData.orderNumber)) {
          importErrors.push({
            row: startRow + index,
            property: 'orderNumber',
            message: `Rebuke with order number ${honorImportData.orderNumber} already exist`
          });

          return false;
        }

        if(!teachers.find(teacher => teacher.id === honorImportData.teacherId)) {
          importErrors.push({
            row: startRow + index,
            property: 'teacher',
            message: `Teacher with id ${honorImportData.teacherId} not exist`
          });

          return false;
        }

        return true;
      });

      await this.rebukeRepository.import(rebukeImportDataArray, request.ignoreErrors);
      return {result: request.ignoreErrors ? true : !importErrors.length, errors: importErrors};
    } catch (e) {
      if (!(e instanceof CustomError)) {
        this.logger.error(e);
        throw new CustomError({code: ErrorCodesEnum.GENERAL, message: e.message});
      }

      throw e;
    }
  }

  async importEducations(request: ImportRequest): Promise<ImportResponse> {
    try {
      const workbook = new Workbook();
      const file = await request.file;
      const template = await workbook.xlsx.read(file.createReadStream());
      const worksheet = template.getWorksheet(1);

      const importErrors: Array<ImportErrorResponse> = [];
      let educationImportDataArray: Array<EducationImportData> = [];
      let startRow = request.from ?? ImportService.START_ROW;
      let currentRow = startRow;

      while (true) {
        const row = worksheet.getRow(currentRow);

        //read data from row
        const educationImportData = new EducationImportData();

        if(row.getCell(EducationImportColumnsEnum.TEACHER).value) {
          educationImportData.teacherId = Number(row.getCell(EducationImportColumnsEnum.TEACHER).value.toString().split(' - ')[0]);
        }

        if(row.getCell(EducationImportColumnsEnum.EDUCATION_QUALIFICATION).value) {
          educationImportData.educationQualificationId = Number(row.getCell(EducationImportColumnsEnum.EDUCATION_QUALIFICATION)
            .value.toString().split(' - ')[0]);
        }

        educationImportData.institution = String(row.getCell(EducationImportColumnsEnum.INSTITUTION).value ?? '');
        educationImportData.specialty = String(row.getCell(EducationImportColumnsEnum.SPECIALTY).value ?? '');

        if(row.getCell(EducationImportColumnsEnum.YEAR_OF_ISSUE).value){
          educationImportData.yearOfIssue = Number(String(row.getCell(EducationImportColumnsEnum.YEAR_OF_ISSUE).value ?? 0));
        }

        if(row.getCell(EducationImportColumnsEnum.DESCRIPTION).value) {
          educationImportData.description = String(row.getCell(EducationImportColumnsEnum.DESCRIPTION).value ?? '');
        }

        if((isNil(request.to) && !isFilledWithData(row)) || (!isNil(request.to) && currentRow <= request.to)) {
          break;
        }
        else {
          //data validation of row
          const validationErrors = await validate(educationImportData);
          validationErrors.forEach(validationError => {
            Object.values(validationError.constraints).map(errorMessage => {
              importErrors.push({row: currentRow, property: validationError.property, message: errorMessage});
            });
          });

          //add row to import if valid
          if(!validationErrors.length) {
            educationImportDataArray.push(educationImportData);
          }

          currentRow++;
        }
      }

      if(!educationImportDataArray.length && !importErrors.length) {
        importErrors.push({message: 'No data to import'});
      }

      //logic validation
      const existTeachers: Array<number> = [];
      const existEducationQualifications: Array<number> = [];

      educationImportDataArray = educationImportDataArray.filter((educationImportData, index) => {
        existTeachers.push(educationImportData.teacherId);
        existEducationQualifications.push(educationImportData.educationQualificationId);
        return true;
      });

      //local file validation without database end
      if(!request.ignoreErrors && importErrors.length) {
        return {result: false, errors: importErrors};
      }

      //get data to validate unique
      let teachers: Array<TeacherDbModel> = [];
      let educationQualifications: Array<EducationQualificationDbModel> = [];

      if(existTeachers.length) {
        const getTeachersRequest = this.importMapper.initializeGetTeachersByIds(uniq(existTeachers));
        const teacherResponse = await this.teacherRepository.getTeachers(getTeachersRequest);
        teachers = teacherResponse.data.responseList;
      }

      if(existEducationQualifications.length) {
        const getEducationQualificationsRequest = this.importMapper.initializeGetEducationQualificationsByIds(uniq(existEducationQualifications));
        const educationQualificationsResponse = await this.educationQualificationRepository.getEducationQualification(getEducationQualificationsRequest);
        educationQualifications = educationQualificationsResponse.data.responseList;
      }

      educationImportDataArray = educationImportDataArray.filter((educationImportData, index) => {
        if(!teachers.find(teacher => teacher.id === educationImportData.teacherId)) {
          importErrors.push({
            row: startRow + index,
            property: 'teacher',
            message: `Teacher with id ${educationImportData.teacherId} not exist`
          });

          return false;
        }

        if(!educationQualifications.find(educationQualification => educationQualification.id === educationImportData.educationQualificationId)) {
          importErrors.push({
            row: startRow + index,
            property: 'educationQualification',
            message: `Education qualification with id ${educationImportData.educationQualificationId} not exist`
          });

          return false;
        }

        return true;
      });

      await this.educationRepository.import(educationImportDataArray, request.ignoreErrors);
      return {result: request.ignoreErrors ? true : !importErrors.length, errors: importErrors};
    } catch (e) {
      if (!(e instanceof CustomError)) {
        this.logger.error(e);
        throw new CustomError({code: ErrorCodesEnum.GENERAL, message: e.message});
      }

      throw e;
    }
  }

  async importAttestations(request: ImportRequest): Promise<ImportResponse> {
    try {
      const workbook = new Workbook();
      const file = await request.file;
      const template = await workbook.xlsx.read(file.createReadStream());
      const worksheet = template.getWorksheet(1);

      const importErrors: Array<ImportErrorResponse> = [];
      let attestationImportDataArray: Array<AttestationImportData> = [];
      let startRow = request.from ?? ImportService.START_ROW;
      let currentRow = startRow;

      while (true) {
        const row = worksheet.getRow(currentRow);

        //read data from row
        const attestationImportData = new AttestationImportData();

        if(row.getCell(AttestationImportColumnsEnum.TEACHER).value) {
          attestationImportData.teacherId = Number(row.getCell(AttestationImportColumnsEnum.TEACHER).value.toString().split(' - ')[0]);
        }

        if(row.getCell(AttestationImportColumnsEnum.CATEGORY).value) {
          attestationImportData.categoryId = Number(row.getCell(AttestationImportColumnsEnum.CATEGORY).value.toString().split(' - ')[0]);
        }

        if(row.getCell(AttestationImportColumnsEnum.DATE).value){
          attestationImportData.date = new Date(String(row.getCell(AttestationImportColumnsEnum.DATE).value ?? ''));
        }

        if(row.getCell(EducationImportColumnsEnum.DESCRIPTION).value) {
          attestationImportData.description = String(row.getCell(EducationImportColumnsEnum.DESCRIPTION).value ?? '');
        }

        if((isNil(request.to) && !isFilledWithData(row)) || (!isNil(request.to) && currentRow <= request.to)) {
          break;
        }
        else {
          //data validation of row
          const validationErrors = await validate(attestationImportData);
          validationErrors.forEach(validationError => {
            Object.values(validationError.constraints).map(errorMessage => {
              importErrors.push({row: currentRow, property: validationError.property, message: errorMessage});
            });
          });

          //add row to import if valid
          if(!validationErrors.length) {
            attestationImportDataArray.push(attestationImportData);
          }

          currentRow++;
        }
      }

      if(!attestationImportDataArray.length && !importErrors.length) {
        importErrors.push({message: 'No data to import'});
      }

      //logic validation
      const existTeachers: Array<number> = [];
      const existCategories: Array<number> = [];

      attestationImportDataArray = attestationImportDataArray.filter(educationImportData => {
        existTeachers.push(educationImportData.teacherId);
        existCategories.push(educationImportData.categoryId);
        return true;
      });

      //local file validation without database end
      if(!request.ignoreErrors && importErrors.length) {
        return {result: false, errors: importErrors};
      }

      //get data to validate unique
      let teachers: Array<TeacherDbModel> = [];
      let categories: Array<CategoryDbModel> = [];

      if(existTeachers.length) {
        const getTeachersRequest = this.importMapper.initializeGetTeachersByIds(uniq(existTeachers));
        const teacherResponse = await this.teacherRepository.getTeachers(getTeachersRequest);
        teachers = teacherResponse.data.responseList;
      }

      if(existCategories.length) {
        const getCategoriesRequest = this.importMapper.initializeGetCategoriesByIds(uniq(existCategories));
        const categoriesResponse = await this.categoryRepository.getCategories(getCategoriesRequest);
        categories = categoriesResponse.data.responseList;
      }

      attestationImportDataArray = attestationImportDataArray.filter((attestationImportData, index) => {
        if(!teachers.find(teacher => teacher.id === attestationImportData.teacherId)) {
          importErrors.push({
            row: startRow + index,
            property: 'teacher',
            message: `Teacher with id ${attestationImportData.teacherId} not exist`
          });

          return false;
        }

        if(!categories.find(category => category.id === attestationImportData.categoryId)) {
          importErrors.push({
            row: startRow + index,
            property: 'category',
            message: `Category with id ${attestationImportData.categoryId} not exist`
          });

          return false;
        }

        return true;
      });

      await this.attestationRepository.import(attestationImportDataArray, request.ignoreErrors);
      return {result: request.ignoreErrors ? true : !importErrors.length, errors: importErrors};
    } catch (e) {
      if (!(e instanceof CustomError)) {
        this.logger.error(e);
        throw new CustomError({code: ErrorCodesEnum.GENERAL, message: e.message});
      }

      throw e;
    }
  }
}
