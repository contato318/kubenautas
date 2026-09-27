import type { SimulatorId } from '../../types';
import DeploymentSim from './DeploymentSim';
import RollingUpdateSim from './RollingUpdateSim';
import ServiceSim from './ServiceSim';
import SchedulerSim from './SchedulerSim';
import HpaSim from './HpaSim';
import PodLifecycleSim from './PodLifecycleSim';
import KubectlTerminal from './KubectlTerminal';

const map: Record<SimulatorId, () => JSX.Element> = {
  deployment: DeploymentSim,
  'rolling-update': RollingUpdateSim,
  service: ServiceSim,
  scheduler: SchedulerSim,
  hpa: HpaSim,
  'pod-lifecycle': PodLifecycleSim,
  terminal: KubectlTerminal,
};

export default function SimulatorHost({ id }: { id: SimulatorId }) {
  const Sim = map[id];
  return <Sim />;
}
