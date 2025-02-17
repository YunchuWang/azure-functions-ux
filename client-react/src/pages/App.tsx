import { Router } from '@reach/router';
import { Fabric } from '@fluentui/react';
import React, { useState, useEffect, Suspense } from 'react';
import SiteRouter from './app/SiteRouter';
import LandingPage from './LandingPage/LandingPage';
import ErrorLogger from '../components/ErrorLogger';
import { I18nextProvider } from 'react-i18next';
import i18n from '../utils/i18n';
import { PortalContext } from '../PortalContext';
import PortalCommunicator from '../portal-communicator';
import { lightTheme } from '../theme/light';
import { ThemeExtended } from '../theme/SemanticColorsExtended';
import { ThemeContext } from '../ThemeContext';
import { IFeatureInfo, IStartupInfo } from '../models/portal-models';
import { StartupInfoContext } from '../StartupInfoContext';
import LoadingComponent from '../components/Loading/LoadingComponent';
import StaticSiteRouter from './static-app/StaticSiteRouter';
import ContainerAppRouter from './container-app/ContainerAppRouter';
import ContainerAppEnvironmentRouter from './container-app/ContainerAppEnvironmentRouter';
import LogicAppRouter from './logic-app/LogicAppRouter';

const portalCommunicator = new PortalCommunicator();

export const App: React.FC = () => {
  const [theme, setTheme] = useState(lightTheme as ThemeExtended);
  const [startupInfo, setStartupInfo] = useState({} as IStartupInfo<any>);
  const [featureInfo, setFeatureInfo] = useState({} as IFeatureInfo<any>);

  useEffect(() => {
    portalCommunicator.initializeIframe(setTheme, setStartupInfo, setFeatureInfo, i18n);
  }, []);

  useEffect(() => {
    setStartupInfo({ ...startupInfo, featureInfo });
  }, [featureInfo]);

  return (
    <Suspense fallback={<LoadingComponent />}>
      <I18nextProvider i18n={i18n}>
        <ThemeContext.Provider value={theme}>
          <StartupInfoContext.Provider value={startupInfo}>
            <PortalContext.Provider value={portalCommunicator}>
              <Fabric>
                <ErrorLogger>
                  <Router>
                    <SiteRouter path="feature/subscriptions/:subscriptionId/resourcegroups/:resourcegroup/providers/microsoft.web/sites/:siteName/*" />
                    <SiteRouter path="feature/subscriptions/:subscriptionId/resourcegroups/:resourcegroup/providers/microsoft.web/sites/:siteName/slots/:slotName/*" />
                    <SiteRouter path="feature/subscriptions/:subscriptionId/resourcegroups/:resourcegroup/providers/microsoft.web/sites/:siteName/functions/:functionName/*" />
                    <SiteRouter path="feature/subscriptions/:subscriptionId/resourcegroups/:resourcegroup/providers/microsoft.web/sites/:siteName/slots/:slotName/functions/:functionName/*" />
                    <StaticSiteRouter path="feature/subscriptions/:subscriptionId/resourcegroups/:resourcegroup/providers/microsoft.web/staticsites/:staticSiteName/*" />
                    <StaticSiteRouter path="feature/subscriptions/:subscriptionId/providers/microsoft.web/staticsites/*" />
                    <ContainerAppRouter path="feature/subscriptions/:subscriptionId/resourcegroups/:resourcegroup/providers/microsoft.app/containerapps/:appName/*" />
                    <ContainerAppEnvironmentRouter path="feature/subscriptions/:subscriptionId/resourcegroups/:resourcegroup/providers/microsoft.app/managedenvironments/:envName/*" />
                    <LogicAppRouter path="feature/subscriptions/:subscriptionId/providers/microsoft.logic/workflows/*" />
                    <LandingPage path="/*" />
                  </Router>
                </ErrorLogger>
              </Fabric>
            </PortalContext.Provider>
          </StartupInfoContext.Provider>
        </ThemeContext.Provider>
      </I18nextProvider>
    </Suspense>
  );
};

export default App;
