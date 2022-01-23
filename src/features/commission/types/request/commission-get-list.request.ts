import {ArgsType, Field} from '@nestjs/graphql';
import {BasePaginatorRequest} from '../../../../common/types/request/base-paginator.request';
import {CommissionOrderFieldsEnum} from '../../../../data/repositories/commission/enums/commission-order-fields.enum';
import {IsBoolean, IsEnum, IsOptional, IsString} from 'class-validator';

@ArgsType()
export class CommissionGetListRequest extends BasePaginatorRequest {
  select: Array<string>;

  @Field({nullable: true})
  @IsOptional()
  @IsString()
  name: string;

  @Field({nullable: true})
  @IsOptional()
  @IsBoolean()
  showDeleted: boolean;

  @Field({nullable: true, defaultValue: CommissionOrderFieldsEnum.ID})
  @IsOptional()
  @IsEnum(CommissionOrderFieldsEnum)
  orderField: string;

  @Field({nullable: true})
  @IsOptional()
  @IsBoolean()
  isDesc: boolean;
}