import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import RoadmapPage from './pages/RoadmapPage';
import LessonPage from './pages/LessonPage';
import ExamPage from './pages/ExamPage';
import SimulatorsPage from './pages/SimulatorsPage';
import NotFoundPage from './pages/NotFoundPage';
import CasesPage from './pages/CasesPage';
import CasePage from './pages/CasePage';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/trilha" element={<RoadmapPage />} />
        <Route path="/aprender/:moduleId/:slug" element={<LessonPage />} />
        <Route path="/simuladores" element={<SimulatorsPage />} />
        <Route path="/simuladores/:simId" element={<SimulatorsPage />} />
        <Route path="/casos" element={<CasesPage />} />
        <Route path="/casos/:slug" element={<CasePage />} />
        <Route path="/prova" element={<ExamPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
