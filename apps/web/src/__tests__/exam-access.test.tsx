// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@jack-academy/contracts';
import { useAccount } from '../auth/AccountProvider';
import ExamPage, { EXAM_SIZE } from '../pages/ExamPage';

let account: Pick<ReturnType<typeof useAccount>, 'user' | 'status' | 'progress' | 'recordExam' | 'saving' | 'error' | 'retrySave'>;
const track = vi.fn();
vi.mock('../auth/AccountProvider', () => ({ useAccount: () => account }));
vi.mock('../hooks/useActivity', () => ({ useActivity: () => track }));
vi.mock('../components/CertificateSection', () => ({ default: () => null }));
vi.mock('motion/react', async (original) => ({ ...await original<typeof import('motion/react')>(), useReducedMotion: () => true }));

const student: User = { id: 'student', name: 'Estudante', email: null, avatarUrl: null, provider: 'google', welcomeCompleted: false, isAdmin: false };
const view = () => <MemoryRouter initialEntries={['/prova']}><ExamPage /></MemoryRouter>;
beforeEach(() => {
  account = { user: null, status: 'ready', progress: { completed: {}, quizzes: {}, cases: {} }, recordExam: vi.fn().mockResolvedValue(true), saving: false, error: null, retrySave: vi.fn().mockResolvedValue(undefined) };
  track.mockReset();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('final exam access', () => {
  it('keeps the presentation public and directs guests to login before starting an attempt', () => {
    render(view());
    expect(screen.getByRole('heading', { name: 'Prova final' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Revisar a trilha' }).getAttribute('href')).toBe('/trilha');
    expect(screen.getByRole('link', { name: 'Entrar para fazer a prova' }).getAttribute('href')).toBe('/entrar?returnTo=%2Fprova');
    expect(screen.queryByRole('button', { name: 'Iniciar prova' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull();
    expect(track).not.toHaveBeenCalled();
    expect(account.recordExam).not.toHaveBeenCalled();
  });

  it.each(['loading', 'error'] as const)('blocks starting while session status is %s, including with a cached account', (status) => {
    account = { ...account, user: student, status };
    render(view());
    const start = screen.getByRole('button', { name: status === 'loading' ? 'Verificando sua conta…' : 'Iniciar prova' });
    expect((start as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(start);
    expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull();
    expect(track).not.toHaveBeenCalled();
    if (status === 'error') {
      fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
      expect(account.retrySave).toHaveBeenCalledOnce();
    }
  });

  it('lets a signed-in student start, answer all questions and submit one final score', () => {
    account.user = student;
    render(view());
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar prova' }));
    expect(track).toHaveBeenCalledOnce();
    expect(track).toHaveBeenCalledWith('exam_started', 'final');
    for (let index = 0; index < EXAM_SIZE; index++) {
      fireEvent.click(screen.getByRole('button', { name: /^A / }));
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
      if (index < EXAM_SIZE - 1) {
        expect(account.recordExam).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
      }
    }
    expect(account.recordExam).toHaveBeenCalledOnce();
    expect(account.recordExam).toHaveBeenCalledWith(expect.any(Number));
    fireEvent.click(screen.getByRole('button', { name: 'Ver resultado' }));
    expect(screen.getByText('Prova final · resultado')).toBeTruthy();
  });

  it('blocks answering and drawing another exam if the session is lost mid-attempt', () => {
    account.user = student;
    const { rerender } = render(view());
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar prova' }));
    fireEvent.click(screen.getByRole('button', { name: /^A / }));
    account.user = null;
    rerender(view());
    const confirm = screen.getByRole('button', { name: 'Confirmar' });
    const redraw = screen.getByRole('button', { name: 'Sortear nova prova' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((redraw as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirm);
    fireEvent.click(redraw);
    expect(track).toHaveBeenCalledOnce();
    expect(account.recordExam).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Entrar com Google ou GitHub' })).toBeTruthy();
  });
});
