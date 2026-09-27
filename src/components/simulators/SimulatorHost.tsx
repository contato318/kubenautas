import type { SimulatorId } from '../../types';
import DeploymentSim from './DeploymentSim';
import RollingUpdateSim from './RollingUpdateSim';
import ServiceSim from './ServiceSim';
import SchedulerSim from './SchedulerSim';
import HpaSim from './HpaSim';
import PodLifecycleSim from './PodLifecycleSim';
import KubectlTerminal from './KubectlTerminal';
import NetworkPolicySim from './NetworkPolicySim';
import RbacSim from './RbacSim';
import DrainPdbSim from './DrainPdbSim';
import QosSim from './QosSim';
import StorageSim from './StorageSim';
import IngressSim from './IngressSim';
import DnsSim from './DnsSim';
import StatefulSetSim from './StatefulSetSim';
import CronJobSim from './CronJobSim';
import ClusterAutoscalerSim from './ClusterAutoscalerSim';
import GatewayApiSim from './GatewayApiSim';
import RbacLabSim from './RbacLabSim';
import HelmReleaseSim from './HelmReleaseSim';
import HelmLintSim from './HelmLintSim';
import HelmValuesSim from './HelmValuesSim';
import HelmTemplateSim from './HelmTemplateSim';
import HelmHelpersSim from './HelmHelpersSim';
import HelmDependenciesSim from './HelmDependenciesSim';
import HelmHooksSim from './HelmHooksSim';
import HelmSemverSim from './HelmSemverSim';
import HelmUpgradeSim from './HelmUpgradeSim';

const map: Record<SimulatorId, () => JSX.Element> = {
  deployment: DeploymentSim,
  'rolling-update': RollingUpdateSim,
  service: ServiceSim,
  scheduler: SchedulerSim,
  hpa: HpaSim,
  'pod-lifecycle': PodLifecycleSim,
  terminal: KubectlTerminal,
  'network-policy': NetworkPolicySim,
  rbac: RbacSim,
  'drain-pdb': DrainPdbSim,
  qos: QosSim,
  storage: StorageSim,
  ingress: IngressSim,
  dns: DnsSim,
  statefulset: StatefulSetSim,
  cronjob: CronJobSim,
  'cluster-autoscaler': ClusterAutoscalerSim,
  'gateway-api': GatewayApiSim,
  'rbac-lab': RbacLabSim,
  'helm-release': HelmReleaseSim,
  'helm-lint': HelmLintSim,
  'helm-values': HelmValuesSim,
  'helm-template': HelmTemplateSim,
  'helm-helpers': HelmHelpersSim,
  'helm-dependencies': HelmDependenciesSim,
  'helm-hooks': HelmHooksSim,
  'helm-semver': HelmSemverSim,
  'helm-upgrade': HelmUpgradeSim,
};

export default function SimulatorHost({ id }: { id: SimulatorId }) {
  const Sim = map[id];
  return <Sim />;
}
