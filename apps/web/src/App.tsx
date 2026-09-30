import { Outlet, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import RoadmapPage from './pages/RoadmapPage';
import LessonPage from './pages/LessonPage';
import ExamPage from './pages/ExamPage';
import SimulatorsPage from './pages/SimulatorsPage';
import SimulatorWorkspace from './pages/SimulatorWorkspace';
import NotFoundPage from './pages/NotFoundPage';
import CasesPage from './pages/CasesPage';
import CasePage from './pages/CasePage';
import LoginPage from './pages/LoginPage';
import WelcomePage from './pages/WelcomePage';
import ProfilePage from './pages/ProfilePage';
import CertificatePage from './pages/CertificatePage';
import PublicCertificatePage from './pages/PublicCertificatePage';
import AdminShell from './components/admin/AdminShell';
import AdminOverviewPage from './pages/admin/AdminOverviewPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminUserPage from './pages/admin/AdminUserPage';
import LegalPage from './pages/LegalPage';

export default function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<LoginPage />} />
      <Route path="/boas-vindas" element={<WelcomePage />} />
      <Route path="/certificados/:id" element={<PublicCertificatePage />} />
      <Route path="/simuladores/:simId" element={<SimulatorWorkspace />} />
      <Route element={<Layout><Outlet /></Layout>}>
        <Route path="/" element={<HomePage />} />
        <Route path="/trilha" element={<RoadmapPage />} />
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="/termos-de-uso" element={<LegalPage kind="terms" />} />
        <Route path="/privacidade" element={<LegalPage kind="privacy" />} />
        <Route path="/lgpd" element={<LegalPage kind="lgpd" />} />
        <Route path="/certificado" element={<CertificatePage />} />
        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="usuarios" element={<AdminUsersPage />} />
          <Route path="usuarios/:id" element={<AdminUserPage />} />
        </Route>
        <Route path="/aprender/:moduleId/:slug" element={<LessonPage />} />
        <Route path="/simuladores" element={<SimulatorsPage />} />
        <Route path="/casos" element={<CasesPage />} />
        <Route path="/casos/:slug" element={<CasePage />} />
        <Route path="/prova" element={<ExamPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
