import {GqlExecutionContext} from '@nestjs/graphql';
import {Reflector} from '@nestjs/core';
import {CanActivate, ExecutionContext, Injectable} from '@nestjs/common';
import {Observable} from 'rxjs';
import {JwtService} from '@nestjs/jwt';
import {isNil} from 'lodash';
import {IAccessTokenInfoInterface} from '../types/interface/IAccessTokenInfo.interface';
import {CustomError} from '../class/custom-error';
import {ErrorCodesEnum} from '../constants/error-codes.enum';
import {MetaDataFieldEnum} from '../constants/meta-data-fields.enum';

@Injectable()
export class IsAuthorisedGuard implements CanActivate {
  constructor(private jwtService: JwtService, private reflector: Reflector) {
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const gqlContext = GqlExecutionContext.create(context);

    const isAuthorized = this.reflector.get<boolean>(MetaDataFieldEnum.IS_CHECK_AUTHORIZATION, gqlContext.getHandler());
    if (isAuthorized || isNil(isAuthorized)) {
      const token = gqlContext.getContext().req.headers['authorization'];
      try {
        const payload = this.jwtService.verify<IAccessTokenInfoInterface>(
          token,
          {secret: process.env.JWT_ACCESS_TOKEN_SECRET}
        );

        return !!payload.userId;
      } catch (e) {
        throw new CustomError({
          code: ErrorCodesEnum.UNAUTHORIZED,
          message: e.message
        })
      }
    } else {
      return true;
    }
  }
}
