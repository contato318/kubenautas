// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@jack-academy/contracts';
import SimulatorWorkspace from '../pages/SimulatorWorkspace';
import KubectlTerminal from '../components/simulators/KubectlTerminal';

const account = { user: null as User | null, error: null, status: 'ready', logout: vi.fn() };
vi.mock('../auth/AccountProvider', () => ({ useAccount: () => account }));
vi.mock('../hooks/useActivity', () => ({ useActivityVisit: vi.fn() }));
// Navigation tests exercise the shell independently of each simulator's engine.
vi.mock('../components/simulators/SimulatorHost', () => ({ default: ({ id }: { id: string }) => <input aria-label={`Experimento ${id}`} defaultValue="" /> }));

beforeEach(() => {
  account.user = null;
  Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
});
afterEach(cleanup);

const shell = (path = '/simuladores/terminal?tema=cluster&q=pods#pratica') => <MemoryRouter initialEntries={[path]}><Routes><Route path="/simuladores/:simId" element={<SimulatorWorkspace />} /></Routes></MemoryRouter>;

describe('simulator workspace', () => {
  it('keeps guest access and sends login back to the exact laboratory URL', () => {
    render(shell());
    expect(screen.getByRole('heading', { name: 'Terminal kubectl' })).toBeTruthy();
    expect(screen.getByLabelText('Experimento terminal')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Entrar' }).getAttribute('href')).toBe('/entrar?returnTo=%2Fsimuladores%2Fterminal%3Ftema%3Dcluster%26q%3Dpods%23pratica');
    expect(screen.getByRole('link', { name: 'Explorar catálogo' }).getAttribute('href')).toBe('/simuladores?tema=cluster&q=pods');
  });

  it('searches across categories, switches the lab and opens its guide', () => {
    render(shell());
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar simulador no menu' }), { target: { value: 'helm' } });
    const nav = screen.getByRole('navigation', { name: 'Escolher simulador' });
    expect(within(nav).queryByRole('link', { name: 'Self-healing' })).toBeNull();
    const link = within(nav).getAllByRole('link')[0];
    expect(link.getAttribute('href')).toMatch(/^\/simuladores\/helm-/);
    fireEvent.click(link);
    expect(screen.queryByLabelText('Experimento terminal')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Guia do laboratório' }));
    const guide = screen.getByRole('dialog', { name: 'Guia do laboratório' });
    expect(within(guide).getByText('Lições relacionadas')).toBeTruthy();
    fireEvent.click(within(guide).getByRole('button', { name: 'Fechar guia' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the mobile menu after selecting a different simulator', () => {
    render(shell());
    fireEvent.click(screen.getByRole('button', { name: 'Trocar simulador' }));
    const menu = screen.getByRole('dialog', { name: 'Trocar simulador' });
    fireEvent.click(within(menu).getByRole('link', { name: 'Self-healing' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Self-healing' })).toBeTruthy();
  });

  it('clears experiment state when changing users', () => {
    const { rerender } = render(shell());
    fireEvent.change(screen.getByLabelText('Experimento terminal'), { target: { value: 'guest state' } });
    account.user = { id: 'student', name: 'Estudante', email: null, avatarUrl: null, provider: 'google', welcomeCompleted: true, isAdmin: false };
    rerender(shell());
    expect((screen.getByLabelText('Experimento terminal') as HTMLInputElement).value).toBe('');
  });

  it('offers recovery for an unknown simulator', () => {
    render(shell('/simuladores/unknown'));
    expect(screen.getByRole('heading', { name: 'Simulador não encontrado' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Explorar simuladores' }).getAttribute('href')).toBe('/simuladores');
  });
});

describe('kubectl workbench', () => {
  const command = async (value: string) => {
    const input = screen.getByRole('textbox', { name: 'Terminal kubectl' });
    await act(async () => {
      fireEvent.change(input, { target: { value } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    return screen.getByRole('textbox', { name: 'Terminal kubectl' });
  };

  it('executes the first mission and exposes the 23-mission catalog and scenarios', async () => {
    render(<KubectlTerminal workspace />);
    expect(screen.getByRole('combobox', { name: 'Missão 1 de 23' }).querySelectorAll('option')).toHaveLength(23);
    for (const line of ['kubectl get nodes', 'kubectl get pods -A', 'kubectl cluster-info', 'kubectl api-resources']) await command(line);
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('1');
    expect(screen.getByText('Missão concluída!')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preparar cenário' }));
    expect(screen.getByRole('log').textContent).toContain('Cenário preparado: O deploy que não sobe');
    fireEvent.click(screen.getByRole('button', { name: 'Cluster' }));
    expect(screen.getByRole('heading', { name: 'Nós · 3' })).toBeTruthy();
    expect(screen.getAllByText(/shop-/).length).toBeGreaterThan(0);
  });

  it('renders the ZIP shell commands with directory colors and a changing prompt', async () => {
    render(<KubectlTerminal />);
    await command('ls');
    const directory = within(screen.getByRole('log')).getByText('examples', { exact: true });
    expect(directory.style.color).toBe('rgb(96, 165, 250)');
    await command('cd examples; pwd');
    expect(screen.getByRole('log').textContent).toContain('/root/examples');
    expect(screen.getByText('~/examples', { exact: true })).toBeTruthy();
    await command("echo '<img src=x onerror=alert(1)>'");
    expect(screen.getByRole('log').querySelector('img')).toBeNull();
    expect(screen.getByRole('log').textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('supports shell editing shortcuts and empty continuation lines', async () => {
    render(<KubectlTerminal />);
    const input = screen.getByRole('textbox', { name: 'Terminal kubectl' }) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'echo first second' } });
    fireEvent.keyDown(input, { key: 'a', ctrlKey: true });
    expect(input.selectionStart).toBe(0);
    fireEvent.keyDown(input, { key: 'e', ctrlKey: true });
    expect(input.selectionStart).toBe(input.value.length);
    fireEvent.keyDown(input, { key: 'w', ctrlKey: true });
    expect(input.value).toBe('echo first ');
    input.setSelectionRange(5, 5);
    fireEvent.keyDown(input, { key: 'u', ctrlKey: true });
    expect(input.value).toBe('first ');
    input.setSelectionRange(3, 3);
    fireEvent.keyDown(input, { key: 'k', ctrlKey: true });
    expect(input.value).toBe('fir');
    await command("cat <<'EOF' > blank.txt");
    await command('before');
    await command('');
    await command('after');
    await command('EOF');
    await command('cat blank.txt');
    expect(screen.getByRole('log').textContent).toContain('before\n\nafter');
  });

  it('clears output while preserving resources and resets history and objectives on restart', async () => {
    render(<KubectlTerminal />);
    await command('kubectl get nodes');
    await command('kubectl run learner --image=nginx:1.25');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar terminal' }));
    const clearing = screen.getByRole('alertdialog', { name: 'Limpar a saída do terminal?' });
    expect(screen.getByRole('log').textContent).toContain('pod/learner created');
    fireEvent.click(within(clearing).getByRole('button', { name: 'Confirmar limpeza' }));
    expect(screen.getByRole('log').textContent).toBe('');
    expect(screen.getByText('Concluído:')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cluster' }));
    expect(screen.getByText('learner')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar cluster' }));
    const resetting = screen.getByRole('alertdialog', { name: 'Reiniciar o terminal?' });
    expect(screen.getByText('learner')).toBeTruthy();
    fireEvent.click(within(resetting).getByRole('button', { name: 'Confirmar reset' }));
    expect(screen.queryByText('learner')).toBeNull();
    const resetInput = screen.getByRole('textbox', { name: 'Terminal kubectl' });
    fireEvent.keyDown(resetInput, { key: 'ArrowUp' });
    expect((resetInput as HTMLTextAreaElement).value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: /Missões/ }));
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('0');
    expect(screen.queryByText('Concluído:')).toBeNull();
  });

  it('preserves the terminal when reset is cancelled or dismissed with Escape', async () => {
    render(<KubectlTerminal />);
    await command('kubectl get nodes');
    await command('echo keep > notes.txt');
    const output = screen.getByRole('log').textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar cluster' }));
    let dialog = screen.getByRole('alertdialog', { name: 'Reiniciar o terminal?' });
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('log').textContent).toBe(output);
    expect(screen.getByText('Concluído:')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar cluster' }));
    dialog = screen.getByRole('alertdialog', { name: 'Reiniciar o terminal?' });
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await command('cat notes.txt');
    expect(screen.getByRole('log').textContent).toContain('keep');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar terminal' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('log').textContent).toContain('keep');
  });

  it('supports the file editor after StrictMode cleanup and remount', async () => {
    render(<StrictMode><KubectlTerminal /></StrictMode>);
    await act(async () => {
      const input = screen.getByRole('textbox', { name: 'Terminal kubectl' });
      fireEvent.change(input, { target: { value: 'vi strict.yaml' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(screen.getByRole('dialog', { name: 'Editar /root/strict.yaml' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Conteúdo do arquivo' }), { target: { value: 'saved under strict mode' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Salvar arquivo' })); });
    await command('cat strict.yaml');
    expect(screen.getByRole('log').textContent).toContain('saved under strict mode');
  });

  it('supports history, completion, multiline manifests and accessible tab navigation', async () => {
    render(<KubectlTerminal />);
    const input = await command('kubectl get nodes');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect((input as HTMLTextAreaElement).value).toBe('kubectl get nodes');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect((input as HTMLTextAreaElement).value).toBe('');
    expect(fireEvent.keyDown(input, { key: 'Tab' })).toBe(true);
    fireEvent.change(input, { target: { value: 'kubectl get nod' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect((input as HTMLTextAreaElement).value).toBe('kubectl get nodes ');
    expect(fireEvent.keyDown(input, { key: 'Tab', shiftKey: true })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })).toBe(true);
    await command('cat <<EOF | kubectl apply -f -\napiVersion: v1\nkind: Namespace\nmetadata:\n  name: multiline\nEOF');
    expect(screen.getByRole('log').textContent).toContain('namespace/multiline created');
  });
});
