import {Field, ID, InputType} from '@nestjs/graphql';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxDate,
  MaxLength,
  MinDate,
} from 'class-validator';
import {ValidateDate} from '../../../../global/pipes/validate-date';
import {Transform} from 'class-transformer';

@InputType()
export class PublicationCreateRequest {
  select: Array<string>;

  @Field({nullable: false})
  @MaxLength(255)
  @IsNotEmpty()
  @IsString()
  title: string;

  @Field(type => String, {nullable: false})
  @MaxDate(new Date())
  @MinDate(new Date(Date.now() - 100 * 365 * 24 * 60 * 60 * 1000))
  @ValidateDate()
  date: Date;

  @Field({nullable: true})
  @IsOptional()
  @IsString()
  publisher?: string;

  @Field({nullable: true})
  @IsOptional()
  @IsString()
  @IsUrl()
  url?: string;

  @Field({nullable: true})
  @IsOptional()
  @IsString()
  anotherAuthors?: string;

  @Field({nullable: true})
  @IsOptional()
  @IsString()
  description?: string;

  @Field(type => [ID], {nullable: false})
  @Transform(({value}) => Array.isArray(value) ? value.map(el => Number(el)) : [])
  @IsArray()
  @IsNumber({}, {each: true})
  @ArrayUnique()
  @ArrayMinSize(1)
  userIds: Array<number>;
}
