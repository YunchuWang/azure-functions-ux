import { Controller, Post, Query, Req, Body, HttpException } from '@nestjs/common';
import { DeploymentCenterService } from '../deployment-center.service';
import { LoggingService } from '../../shared/logging/logging.service';
import { HttpService } from '../../shared/http/http.service';
import { EventType } from '../../shared/logging/etw.service';

interface Authorization {
  parameters: { [key: string]: string };
  scheme: string;
}

interface CodeRepository {
  authorizationInfo: Authorization;
  defaultBranch: string;
  type: string;
  id?: string;
}

@Controller('api')
export class AzureDevOpsController {
  constructor(private dcService: DeploymentCenterService, private loggingService: LoggingService, private httpService: HttpService) {}

  @Post('setupvso')
  async setupvso(@Query('accountName') accountName: string, @Body('githubToken') githubToken: string, @Body() body, @Req() req) {
    this.loggingService.trackEvent(
      '/api/setupvso/received-request',
      {
        accountName: req.query.accountName,
      },
      undefined,
      EventType.Info
    );

    const uri = `https://${req.query.accountName}.portalext.visualstudio.com/_apis/ContinuousDelivery/ProvisioningConfigurations?api-version=3.2-preview.1`;
    const urlObj = new URL(uri);
    const host = urlObj.host;
    if (host.toLowerCase() !== `${req.query.accountName.toLowerCase()}.portalext.visualstudio.com`) {
      throw new HttpException('The url is not valid', 400);
    }

    const passHeaders = req.headers;

    let repository: CodeRepository = null;
    if (body.source && body.source.repository) {
      repository = body.source.repository;
    } else if (body.repository) {
      repository = body.repository;
    }

    if (repository && repository.type === 'GitHub') {
      this.loggingService.trackEvent(
        '/api/setupvso/dispatch-github-token-request',
        {
          accountName: req.query.accountName,
        },
        undefined,
        EventType.Info
      );

      repository.authorizationInfo.parameters.AccessToken = githubToken;
    }

    delete body.githubToken;

    try {
      const headers: { [key: string]: string } = {
        Authorization: passHeaders.authorization as string,
        'Content-Type': 'application/json',
        accept: 'application/json;api-version=4.1-preview.1',
      };

      if (passHeaders['x-vss-forcemsapassthrough'] === 'true') {
        headers['X-VSS-ForceMsaPassThrough'] = 'true';
      }

      this.loggingService.trackEvent(
        '/api/setupvso/dispatch-vs-request',
        {
          uri,
          method: 'post',
        },
        undefined,
        EventType.Info
      );

      const result = await this.httpService.post(uri, body, {
        headers,
      });
      return result.data;
    } catch (err) {
      if (err.response) {
        this.loggingService.error(err.response.data, 'api/setupvso', 'vso-passthrough');
        throw new HttpException(err.response.data, err.response.status);
      } else {
        this.loggingService.error('No response in error object', 'api/setupvso', 'vso-passthrough');
        throw new HttpException('Internal Server Error', 500);
      }
    }
  }
}
