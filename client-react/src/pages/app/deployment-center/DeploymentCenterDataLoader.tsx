import React, { useState, useEffect, useContext } from 'react';
import { DeploymentCenterDataLoaderProps } from './DeploymentCenter.types';
import DeploymentCenterData from './DeploymentCenter.data';
import { PortalContext } from '../../../PortalContext';
import { SiteStateContext } from '../../../SiteState';
import RbacConstants from '../../../utils/rbac-constants';
import { getErrorMessage } from '../../../ApiHelpers/ArmHelper';
import {
  parsePublishProfileXml,
  PublishMethod,
  PublishingUser,
  PublishingCredentials,
  PublishingProfile,
} from '../../../models/site/publish';
import { useTranslation } from 'react-i18next';
import { ArmObj, ArmArray } from '../../../models/arm-obj';
import { ArmSiteDescriptor } from '../../../utils/resourceDescriptors';
import { DeploymentCenterContext } from './DeploymentCenterContext';
import { DeploymentCenterPublishingContext } from './DeploymentCenterPublishingContext';
import { HttpResponseObject } from '../../../ArmHelper.types';
import DeploymentCenterPublishProfilePanel from './publish-profile/DeploymentCenterPublishProfilePanel';
import LoadingComponent from '../../../components/Loading/LoadingComponent';
import { SiteConfig } from '../../../models/site/config';
import { KeyValue } from '../../../models/portal-models';
import { SourceControl } from '../../../models/provider';
import { PublishingCredentialPolicies } from '../../../models/site/site';
import DeploymentCenterContainerDataLoader from './container/DeploymentCenterContainerDataLoader';
import DeploymentCenterCodeDataLoader from './code/DeploymentCenterCodeDataLoader';
import { getTelemetryInfo } from './utility/DeploymentCenterUtility';
import HostingEnvironmentService from '../../../ApiHelpers/HostingEnvironmentService';
import { InternalLoadBalancingMode } from '../../../models/hostingEnvironment/hosting-environment';

enum SourceControlTypes {
  oneDrive = 'onedrive',
  dropBox = 'dropbox',
  bitBucket = 'bitbucket',
  gitHub = 'github',
}

const DeploymentCenterDataLoader: React.FC<DeploymentCenterDataLoaderProps> = props => {
  const { resourceId, tab } = props;
  const { t } = useTranslation();
  const deploymentCenterData = new DeploymentCenterData();
  const portalContext = useContext(PortalContext);
  const siteStateContext = useContext(SiteStateContext);
  const [hasWritePermission, setHasWritePermission] = useState(false);
  const [publishingUser, setPublishingUser] = useState<ArmObj<PublishingUser> | undefined>(undefined);
  const [publishingUserFetchFailedMessage, setPublishingUserFetchFailedMessage] = useState<string>('');
  const [publishingCredentials, setPublishingCredentials] = useState<ArmObj<PublishingCredentials> | undefined>(undefined);
  const [publishingProfile, setPublishingProfile] = useState<PublishingProfile | undefined>(undefined);
  const [siteDescriptor, setSiteDescriptor] = useState<ArmSiteDescriptor | undefined>(undefined);
  const [applicationSettings, setApplicationSettings] = useState<ArmObj<KeyValue<string>> | undefined>(undefined);
  const [isPublishProfilePanelOpen, setIsPublishProfilePanelOpen] = useState<boolean>(false);
  const [siteConfig, setSiteConfig] = useState<ArmObj<SiteConfig> | undefined>(undefined);
  const [configMetadata, setConfigMetadata] = useState<ArmObj<KeyValue<string>> | undefined>(undefined);
  const [oneDriveToken, setOneDriveToken] = useState<string>('');
  const [dropboxToken, setDropboxToken] = useState<string>('');
  const [bitbucketToken, setBitbucketToken] = useState<string>('');
  const [gitHubToken, setGitHubToken] = useState<string>('');
  const [basicPublishingCredentialsPolicies, setBasicPublishingCredentialsPolicies] = useState<PublishingCredentialPolicies | undefined>(
    undefined
  );
  const [isIlbASE, setIsIlbASE] = useState<boolean>(false);
  const [isDataRefreshing, setIsDataRefreshing] = useState(true);

  const processPublishProfileResponse = (publishProfileResponse: HttpResponseObject<string>) => {
    if (publishProfileResponse.metadata.success) {
      const publishingProfiles = parsePublishProfileXml(publishProfileResponse.data);
      setPublishingProfile(publishingProfiles.filter(profile => profile.publishMethod === PublishMethod.FTP)[0]);
    } else {
      portalContext.log(
        getTelemetryInfo('error', 'processPublishProfileResponse', 'failed', {
          message: getErrorMessage(publishProfileResponse.metadata.error),
          errorAsString: publishProfileResponse.metadata.error ? JSON.stringify(publishProfileResponse.metadata.error) : '',
        })
      );
    }
  };

  const resetApplicationPassword = async () => {
    const notificationId = portalContext.startNotification(
      t('siteSummary_resetProfileNotifyTitle'),
      t('siteSummary_resetProfileNotifyTitle')
    );

    const resetResponse = await deploymentCenterData.resetPublishProfile(resourceId);

    if (resetResponse.metadata.success) {
      const publishProfileResponse = await deploymentCenterData.getPublishProfile(resourceId);
      processPublishProfileResponse(publishProfileResponse);
      portalContext.stopNotification(notificationId, true, t('siteSummary_resetProfileNotifySuccess'));
    } else {
      portalContext.log(
        getTelemetryInfo('error', 'resetPublishProfileResponse', 'failed', {
          message: getErrorMessage(resetResponse.metadata.error),
          errorAsString: resetResponse.metadata.error ? JSON.stringify(resetResponse.metadata.error) : '',
        })
      );
      portalContext.stopNotification(notificationId, false, t('siteSummary_resetProfileNotifyFail'));
    }
  };

  const fetchData = async () => {
    portalContext.log(getTelemetryInfo('info', 'initialDataRequest', 'submit'));
    setIsDataRefreshing(true);

    const writePermissionRequest = portalContext.hasPermission(resourceId, [RbacConstants.writeScope]);
    const getPublishingUserRequest = deploymentCenterData.getPublishingUser();
    const getUserSourceControlsRequest = deploymentCenterData.getUserSourceControls();
    const getSiteConfigRequest = deploymentCenterData.getSiteConfig(resourceId);
    const getConfigMetadataRequest = deploymentCenterData.getConfigMetadata(resourceId);
    const getBasicPublishingCredentialsPoliciesRequest = deploymentCenterData.getBasicPublishingCredentialsPolicies(resourceId);

    const requests: Promise<any>[] = [
      writePermissionRequest,
      getPublishingUserRequest,
      getSiteConfigRequest,
      getConfigMetadataRequest,
      getUserSourceControlsRequest,
    ];

    if (!siteStateContext.isKubeApp) {
      requests.push(getBasicPublishingCredentialsPoliciesRequest);
    }

    if (!!siteStateContext.site && !!siteStateContext.site.properties.hostingEnvironmentId) {
      requests.push(HostingEnvironmentService.fetchHostingEnvironment(siteStateContext.site.properties.hostingEnvironmentId));
    }

    const [
      writePermissionResponse,
      publishingUserResponse,
      siteConfigResponse,
      configMetadataResponse,
      userSourceControlsResponse,
      basicPublishingCredentialsPoliciesResponse,
      hostingEnvironmentResponse,
    ] = await Promise.all(requests);

    if (userSourceControlsResponse.metadata.success) {
      setUserSourceControlTokens(userSourceControlsResponse.data);
    } else {
      portalContext.log(
        getTelemetryInfo('error', 'userSourceControlsResponse', 'failed', {
          message: getErrorMessage(userSourceControlsResponse.metadata.error),
          errorAsString: userSourceControlsResponse.metadata.error ? JSON.stringify(userSourceControlsResponse.metadata.error) : '',
        })
      );
    }

    if (
      !!siteStateContext.site &&
      !!siteStateContext.site.properties.hostingEnvironmentId &&
      !!hostingEnvironmentResponse &&
      hostingEnvironmentResponse.metadata.success
    ) {
      setIsIlbASE(
        !!hostingEnvironmentResponse.data.properties.internalLoadBalancingMode &&
          hostingEnvironmentResponse.data.properties.internalLoadBalancingMode === InternalLoadBalancingMode.PublishingAndWeb
      );
    } else if (!!hostingEnvironmentResponse && !hostingEnvironmentResponse.metadata.success) {
      portalContext.log(
        getTelemetryInfo('error', 'getHostingEnvironment', 'failed', {
          message: getErrorMessage(hostingEnvironmentResponse.metadata.error),
          errorAsString: hostingEnvironmentResponse.metadata.error ? JSON.stringify(hostingEnvironmentResponse.metadata.error) : '',
        })
      );
    }

    if (
      !siteStateContext.isKubeApp &&
      !!basicPublishingCredentialsPoliciesResponse &&
      basicPublishingCredentialsPoliciesResponse.metadata.success
    ) {
      setBasicPublishingCredentialsPolicies(basicPublishingCredentialsPoliciesResponse.data.properties);
    } else if (!siteStateContext.isKubeApp && !!basicPublishingCredentialsPoliciesResponse) {
      portalContext.log(
        getTelemetryInfo('error', 'basicPublishingCredentialsPoliciesResponse', 'failed', {
          message: getErrorMessage(basicPublishingCredentialsPoliciesResponse.metadata.error),
          errorAsString: basicPublishingCredentialsPoliciesResponse.metadata.error
            ? JSON.stringify(basicPublishingCredentialsPoliciesResponse.metadata.error)
            : '',
        })
      );
    }

    setSiteDescriptor(new ArmSiteDescriptor(resourceId));
    setHasWritePermission(writePermissionResponse);

    if (siteConfigResponse.metadata.success) {
      setSiteConfig(siteConfigResponse.data);
    } else {
      portalContext.log(
        getTelemetryInfo('error', 'siteConfigResponse', 'failed', {
          message: getErrorMessage(siteConfigResponse.metadata.error),
          errorAsString: siteConfigResponse.metadata.error ? JSON.stringify(siteConfigResponse.metadata.error) : '',
        })
      );
    }

    if (configMetadataResponse.metadata.success) {
      setConfigMetadata(configMetadataResponse.data);
    } else {
      portalContext.log(
        getTelemetryInfo('error', 'configMetadataResponse', 'failed', {
          message: getErrorMessage(configMetadataResponse.metadata.error),
          errorAsString: configMetadataResponse.metadata.error ? JSON.stringify(configMetadataResponse.metadata.error) : '',
        })
      );
    }

    if (publishingUserResponse.metadata.success) {
      setPublishingUser(publishingUserResponse.data);
    } else {
      setPublishingUserFetchFailedMessage(
        t('publishingUserFetchFailedMessage').format(getErrorMessage(publishingUserResponse.metadata.error))
      );
      portalContext.log(
        getTelemetryInfo('error', 'publishingUserResponse', 'failed', {
          message: getErrorMessage(publishingUserResponse.metadata.error),
          errorAsString: publishingUserResponse.metadata.error ? JSON.stringify(publishingUserResponse.metadata.error) : '',
        })
      );
    }

    if (writePermissionResponse) {
      portalContext.log(getTelemetryInfo('info', 'writePermissionDataRequest', 'submit'));

      const getPublishingCredentialsRequest = deploymentCenterData.getPublishingCredentials(resourceId);
      const getPublishProfileRequest = deploymentCenterData.getPublishProfile(resourceId);
      const fetchApplicationSettingsRequest = deploymentCenterData.fetchApplicationSettings(resourceId);
      const [publishingCredentialsResponse, publishProfileResponse, fetchApplicationSettingsResponse] = await Promise.all([
        getPublishingCredentialsRequest,
        getPublishProfileRequest,
        fetchApplicationSettingsRequest,
      ]);

      if (fetchApplicationSettingsResponse.metadata.success) {
        setApplicationSettings(fetchApplicationSettingsResponse.data);
      } else {
        portalContext.log(
          getTelemetryInfo('error', 'fetchApplicationSettingsResponse', 'failed', {
            message: getErrorMessage(fetchApplicationSettingsResponse.metadata.error),
            errorAsString: fetchApplicationSettingsResponse.metadata.error
              ? JSON.stringify(fetchApplicationSettingsResponse.metadata.error)
              : '',
          })
        );
      }

      if (publishingCredentialsResponse.metadata.success) {
        setPublishingCredentials(publishingCredentialsResponse.data);
      } else {
        portalContext.log(
          getTelemetryInfo('error', 'publishingCredentialsResponse', 'failed', {
            message: getErrorMessage(publishingCredentialsResponse.metadata.error),
            errorAsString: publishingCredentialsResponse.metadata.error ? JSON.stringify(publishingCredentialsResponse.metadata.error) : '',
          })
        );
      }

      processPublishProfileResponse(publishProfileResponse);
    }

    setIsDataRefreshing(false);
  };

  const setUserSourceControlTokens = (sourceControls: ArmArray<SourceControl>) => {
    const getToken = (sourceControl?: ArmObj<SourceControl>) =>
      sourceControl && sourceControl.properties.token ? sourceControl.properties.token : '';

    setOneDriveToken(getToken(sourceControls.value.find(item => item.name.toLocaleLowerCase() === SourceControlTypes.oneDrive)));
    setDropboxToken(getToken(sourceControls.value.find(item => item.name.toLocaleLowerCase() === SourceControlTypes.dropBox)));
    setBitbucketToken(getToken(sourceControls.value.find(item => item.name.toLocaleLowerCase() === SourceControlTypes.bitBucket)));
    setGitHubToken(getToken(sourceControls.value.find(item => item.name.toLocaleLowerCase() === SourceControlTypes.gitHub)));
  };

  const refreshUserSourceControlTokens = async () => {
    portalContext.log(getTelemetryInfo('info', 'refreshUserSourceControlTokens', 'submit'));

    const userSourceControlsResponse = await deploymentCenterData.getUserSourceControls();
    if (userSourceControlsResponse.metadata.success) {
      setUserSourceControlTokens(userSourceControlsResponse.data);
    } else {
      portalContext.log(
        getTelemetryInfo('error', 'userSourceControlsResponse', 'failed', {
          message: getErrorMessage(userSourceControlsResponse.metadata.error),
          errorAsString: userSourceControlsResponse.metadata.error ? JSON.stringify(userSourceControlsResponse.metadata.error) : '',
        })
      );
    }
  };

  const showPublishProfilePanel = () => {
    setIsPublishProfilePanelOpen(true);
  };

  const dismissPublishProfilePanel = () => {
    setIsPublishProfilePanelOpen(false);
  };

  const refresh = async () => {
    return fetchData();
  };

  useEffect(() => {
    if (siteStateContext.site && resourceId) {
      fetchData();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteStateContext.site]);

  return siteStateContext.site && siteConfig ? (
    // NOTE(michinoy): Populate common deployment center level properties
    <DeploymentCenterContext.Provider
      value={{
        resourceId,
        hasWritePermission,
        siteDescriptor,
        siteConfig,
        applicationSettings,
        configMetadata,
        oneDriveToken,
        dropboxToken,
        bitbucketToken,
        gitHubToken,
        isIlbASE,
        refresh,
        refreshUserSourceControlTokens,
      }}>
      {/* NOTE(michinoy): Populate common publishing specific properties */}
      <DeploymentCenterPublishingContext.Provider
        value={{
          basicPublishingCredentialsPolicies,
          publishingUser,
          publishingProfile,
          publishingCredentials,
          publishingUserFetchFailedMessage,
          resetApplicationPassword,
          showPublishProfilePanel,
        }}>
        {/* NOTE(michinoy): Load the specific experience based on the app settings */}
        {siteStateContext.isContainerApp ? (
          <DeploymentCenterContainerDataLoader resourceId={resourceId} tab={tab} isDataRefreshing={isDataRefreshing} />
        ) : (
          <DeploymentCenterCodeDataLoader resourceId={resourceId} tab={tab} isDataRefreshing={isDataRefreshing} />
        )}
        {/* NOTE(michinoy): Load the publishing profile panel which is common between both code and container experiences  */}
        <DeploymentCenterPublishProfilePanel
          isPanelOpen={isPublishProfilePanelOpen}
          dismissPanel={dismissPublishProfilePanel}
          resetApplicationPassword={resetApplicationPassword}
        />
      </DeploymentCenterPublishingContext.Provider>
    </DeploymentCenterContext.Provider>
  ) : (
    <LoadingComponent />
  );
};

export default DeploymentCenterDataLoader;
