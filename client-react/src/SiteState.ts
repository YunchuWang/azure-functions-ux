import React from 'react';
import { FunctionAppEditMode } from './models/portal-models';
import { ArmObj } from './models/arm-obj';
import { Site } from './models/site/site';

export interface ISiteState {
  stopped: boolean;
  siteAppEditState: FunctionAppEditMode;
  isLinuxApp: boolean;
  isContainerApp: boolean;
  isFunctionApp: boolean;
  isKubeApp: boolean;
  resourceId?: string;
  site?: ArmObj<Site>;
  refresh: () => Promise<void>;
}

export const SiteStateContext = React.createContext<ISiteState>({} as ISiteState);
