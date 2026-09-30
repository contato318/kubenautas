// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@jack-academy/contracts';
import { useAccount } from '../auth/AccountProvider';
import Quiz from '../components/Quiz';
import CasePage from '../pages/CasePage';
import TsToolsSim, { MISSIONS as troubleshootingMissions } from '../components/simulators/TsToolsSim';
import PtToolsSim, { MISSIONS as pentestMissions } from '../components/simulators/PtToolsSim';
import { cases } from '../content/cases';
import type { Question } from '../types';

let account: Pick<ReturnType<typeof useAccount>, 'user' | 'status' | 'saving' | 'error' | 'progress' | 'recordCase' | 'retrySave'>;
vi.mock('../auth/AccountProvider', () => ({ useAccount: () => account }));
vi.mock('../hooks/useActivity', () => ({ useActivityVisit: vi.fn() }));

const student: User = { id: 'student', name: 'Estudante', email: null, avatarUrl: null, provider: 'google', welcomeCompleted: false, isAdmin: false };
const question: Question = { q: 'Qual recurso executa containers?', options: ['Pod', 'Service'], answer: 0, explanation: 'O Pod executa os containers.' };
const studyCase = cases[0];
beforeEach(() => {
  account = { user: null, status: 'ready', saving: false, error: null, progress: { completed: {}, quizzes: {}, cases: {} }, recordCase: vi.fn().mockResolvedValue(true), retrySave: vi.fn().mockResolvedValue(undefined) };
});
afterEach(cleanup);

describe('question access', () => {
  it.each(['Quiz', 'Prova final'])('lets guests read %s questions but blocks selecting and submitting answers', (title) => {
    const onFinish = vi.fn();
    const source = title === 'Prova final' ? '/prova?modo=treino#iniciar' : '/aprender/containers/dockerfile?tab=quiz#perguntas';
    render(<MemoryRouter initialEntries={[source]}><Quiz questions={[question]} title={title} onFinish={onFinish} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: question.q })).toBeTruthy();
    const option = screen.getByRole('button', { name: 'A Pod' });
    const confirm = screen.getByRole('button', { name: 'Confirmar' });
    expect((option as HTMLButtonElement).disabled).toBe(true);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(option);
    fireEvent.click(confirm);
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.queryByText(question.explanation)).toBeNull();
    expect(screen.getByRole('link', { name: 'Entrar com Google ou GitHub' }).getAttribute('href')).toBe(`/entrar?returnTo=${encodeURIComponent(source)}`);
  });

  it.each(['loading', 'error'] as const)('blocks answers while session status is %s even with a cached user', (status) => {
    account = { ...account, user: student, status };
    const onFinish = vi.fn();
    render(<MemoryRouter><Quiz questions={[question]} onFinish={onFinish} /></MemoryRouter>);
    expect((screen.getByRole('button', { name: 'A Pod' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Confirmar' }) as HTMLButtonElement).disabled).toBe(true);
    if (status === 'error') {
      fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
      expect(account.retrySave).toHaveBeenCalledOnce();
    }
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('lets authenticated students answer and finish the quiz', () => {
    account.user = student;
    const onFinish = vi.fn();
    render(<MemoryRouter><Quiz questions={[question]} onFinish={onFinish} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'A Pod' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onFinish).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledWith(1);
    expect(screen.getByText(question.explanation)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver resultado' }));
    expect(screen.getByText('1/1')).toBeTruthy();
  });

  it('blocks a previously selected answer when the session is lost before confirmation', () => {
    account.user = student;
    const onFinish = vi.fn();
    const view = () => <MemoryRouter><Quiz questions={[question]} onFinish={onFinish} /></MemoryRouter>;
    const { rerender } = render(view());
    fireEvent.click(screen.getByRole('button', { name: 'A Pod' }));
    account.user = null;
    rerender(view());
    const confirm = screen.getByRole('button', { name: 'Confirmar' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirm);
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.queryByText(question.explanation)).toBeNull();
  });
});

function renderCase() {
  return render(<MemoryRouter initialEntries={[`/casos/${studyCase.slug}`]}><Routes><Route path="/casos/:slug" element={<CasePage />} /></Routes></MemoryRouter>);
}

describe('case study access', () => {
  it('keeps the case and its solution readable for guests without recording a diagnosis', () => {
    renderCase();
    expect(screen.getByRole('heading', { name: studyCase.diagnosis.q })).toBeTruthy();
    const answer = screen.getByText(studyCase.diagnosis.options[studyCase.diagnosis.answer]).closest('button')!;
    expect(answer.disabled).toBe(true);
    fireEvent.click(answer);
    expect(screen.queryByText('Diagnóstico certeiro!')).toBeNull();
    const solutionTitle = studyCase.solution.match(/^## (.+)$/m)![1];
    expect(screen.queryByRole('heading', { name: solutionTitle })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'pular e ver a solução' }));
    expect(screen.getByRole('heading', { name: solutionTitle })).toBeTruthy();
    expect(account.recordCase).not.toHaveBeenCalled();
  });

  it('records the diagnosis for an authenticated student', () => {
    account.user = student;
    renderCase();
    fireEvent.click(screen.getByText(studyCase.diagnosis.options[studyCase.diagnosis.answer]));
    expect(account.recordCase).toHaveBeenCalledOnce();
    expect(account.recordCase).toHaveBeenCalledWith(studyCase.slug, true);
    expect(screen.getByText('Diagnóstico certeiro!')).toBeTruthy();
  });
});

describe('tool challenge access', () => {
  it.each([
    { name: 'troubleshooting', Component: TsToolsSim, mission: troubleshootingMissions[0] },
    { name: 'pentest', Component: PtToolsSim, mission: pentestMissions[0] },
  ])('requires login to answer $name questions while keeping them readable', ({ Component, mission }) => {
    const view = () => <MemoryRouter><Component /></MemoryRouter>;
    const { rerender } = render(view());
    expect(screen.getByText(mission.situation)).toBeTruthy();
    const answer = screen.getByText(mission.options[mission.answer], { exact: false }).closest('button')!;
    expect(answer.disabled).toBe(true);
    fireEvent.click(answer);
    expect(screen.queryByText(mission.why, { exact: false })).toBeNull();
    account.user = student;
    rerender(view());
    fireEvent.click(screen.getByText(mission.options[mission.answer], { exact: false }));
    expect(screen.getByText(mission.why, { exact: false })).toBeTruthy();
  });
});
