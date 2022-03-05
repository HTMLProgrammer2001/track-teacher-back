import {Injectable} from '@nestjs/common';
import {FileServiceInterface} from './file-service.interface';
import {FileUpload} from 'graphql-upload';
import {randomUUID} from 'crypto';
import {createWriteStream} from 'fs';
import {Workbook} from 'exceljs';
import {ExportTypeEnum} from '../../../features/export/types/common/export-type.enum';
import {ConfigService} from '@nestjs/config';
import {dateToString} from '../../utils/functions';

@Injectable()
export class LocalFileService extends FileServiceInterface {
  constructor(private configService: ConfigService) {
    super();
  }

  async uploadAvatar(file: FileUpload): Promise<string> {
    const {createReadStream, filename} = file;
    const newFileName = `${randomUUID()}.${filename.split('.').pop()}`;
    await createReadStream().pipe(createWriteStream(`./static/avatars/${newFileName}`));
    return `${this.configService.get('APP_URL')}/static/avatars/${newFileName}`;
  }

  async saveReport(workbook: Workbook, type: ExportTypeEnum): Promise<string> {
    const date = new Date();
    const hash = `${dateToString(date)}_${date.getHours()}.${date.getMinutes()}.${date.getSeconds()}`;
    const fileName = type === ExportTypeEnum.EXCEL ? `Report-teacher-${hash}.xlsx` : `Report-teacher-${hash}.csv`;

    await workbook.xlsx.writeFile(`./static/reports/${fileName}`);
    return `${this.configService.get('APP_URL')}/static/reports/${fileName}`;
  }
}
