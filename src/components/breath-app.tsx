'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
	ArrowLeft,
	ArrowRight,
	BarChart3,
	Check,
	Moon,
	Settings2,
	Sun,
	Volume2,
	Waves,
	X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { patterns, type BreathPattern } from '@/lib/patterns';
import {
	computeStreak,
	defaultPreference,
	getPreference,
	getSessions,
	savePreference,
	saveSession,
	toLocalDateKey,
	type LocalPreference,
	type LocalSession,
} from '@/lib/local-db';
import { retryUnsyncedSessions, syncSession } from '@/lib/sync';

type View = 'home' | 'session' | 'end' | 'history';

const circleScale = {
	inhale: 1.34,
	exhale: 0.78,
	hold: 1.08,
};

export function BreathApp() {
	const [view, setView] = useState<View>('home');
	const [preference, setPreference] =
		useState<LocalPreference>(defaultPreference);
	const [sessions, setSessions] = useState<LocalSession[]>([]);
	const [patternIndex, setPatternIndex] = useState(0);
	const [activeSession, setActiveSession] = useState<LocalSession | null>(null);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const selectedPattern = patterns[patternIndex];

	const refreshSessions = useCallback(async () => {
		setSessions(await getSessions());
	}, []);

	useEffect(() => {
		let mounted = true;

		async function init() {
			const storedPreference = await getPreference();
			if (!mounted) return;
			setPreference(storedPreference);
			setPatternIndex(
				Math.max(
					0,
					patterns.findIndex(
						p => p.slug === storedPreference.defaultPatternSlug,
					),
				),
			);
			applyTheme(storedPreference.theme);
			await refreshSessions();
			await retryUnsyncedSessions();
			await refreshSessions();
		}

		init();
		return () => {
			mounted = false;
		};
	}, [refreshSessions]);

	const updatePreference = async (next: LocalPreference) => {
		setPreference(next);
		applyTheme(next.theme);
		await savePreference(next);
	};

	const choosePattern = (direction: 1 | -1) => {
		setPatternIndex(
			current => (current + direction + patterns.length) % patterns.length,
		);
	};

	const startSession = () => {
		setActiveSession({
			id: crypto.randomUUID(),
			patternSlug: selectedPattern.slug,
			startedAt: new Date().toISOString(),
			durationSec: 0,
			completed: false,
			synced: false,
		});
		setView('session');
	};

	const finishSession = async (durationSec: number, completed: boolean) => {
		if (!activeSession) return;
		const session = { ...activeSession, durationSec, completed, synced: false };
		await saveSession(session);
		setActiveSession(session);
		setView('end');
		await refreshSessions();
		const synced = await syncSession(session);
		if (synced) await refreshSessions();
	};

	const saveMood = async (moodAfter: number) => {
		if (!activeSession) return;
		const updated = { ...activeSession, moodAfter };
		setActiveSession(updated);
		await saveSession(updated);
		await refreshSessions();
		await syncSession(updated);
		await refreshSessions();
	};

	return (
		<main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
			<AnimatePresence mode="wait">
				{view === 'home' && (
					<HomeScreen
						key="home"
						pattern={selectedPattern}
						patternIndex={patternIndex}
						sessions={sessions}
						preference={preference}
						settingsOpen={settingsOpen}
						onPrev={() => choosePattern(-1)}
						onNext={() => choosePattern(1)}
						onSelectPattern={setPatternIndex}
						onStart={startSession}
						onHistory={() => setView('history')}
						onOpenSettings={() => setSettingsOpen(true)}
						onCloseSettings={() => setSettingsOpen(false)}
						onPreferenceChange={updatePreference}
					/>
				)}

				{view === 'session' && activeSession && (
					<SessionScreen
						key="session"
						pattern={selectedPattern}
						preference={preference}
						onFinish={finishSession}
					/>
				)}

				{view === 'end' && activeSession && (
					<EndScreen
						key="end"
						session={activeSession}
						pattern={selectedPattern}
						onMood={saveMood}
						onHome={() => {
							setActiveSession(null);
							setView('home');
						}}
					/>
				)}

				{view === 'history' && (
					<HistoryScreen
						key="history"
						sessions={sessions}
						onHome={() => setView('home')}
					/>
				)}
			</AnimatePresence>
		</main>
	);
}

function HomeScreen({
	pattern,
	patternIndex,
	sessions,
	preference,
	settingsOpen,
	onPrev,
	onNext,
	onSelectPattern,
	onStart,
	onHistory,
	onOpenSettings,
	onCloseSettings,
	onPreferenceChange,
}: {
	pattern: BreathPattern;
	patternIndex: number;
	sessions: LocalSession[];
	preference: LocalPreference;
	settingsOpen: boolean;
	onPrev: () => void;
	onNext: () => void;
	onSelectPattern: (index: number) => void;
	onStart: () => void;
	onHistory: () => void;
	onOpenSettings: () => void;
	onCloseSettings: () => void;
	onPreferenceChange: (preference: LocalPreference) => void;
}) {
	const streak = computeStreak(sessions);
	const patternVars = getPatternVars(pattern);

	return (
		<motion.section
			className="relative min-h-screen overflow-hidden bg-[var(--pattern-bg)]"
			style={patternVars}
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
		>
			<div className="fixed left-4 right-4 top-4 z-20 flex items-center justify-between sm:left-6 sm:right-6">
				<button
					className="quiet-icon-button"
					onClick={onHistory}
					aria-label="Open history"
					title="History"
				>
					<BarChart3 size={20} />
				</button>
				<div className="flex items-center gap-3">
					<div className="text-right text-sm text-[var(--muted)]">
						<span className="font-medium text-[var(--foreground)]">{streak}</span>{' '}
						day streak
					</div>
					<button
						className="quiet-icon-button"
						onClick={onOpenSettings}
						aria-label="Open settings"
						title="Settings"
					>
						<Settings2 size={20} />
					</button>
				</div>
			</div>

			<button
				className="edge-nav edge-nav-left"
				onClick={onPrev}
				aria-label="Previous pattern"
				title="Previous"
			>
				<ArrowLeft size={28} />
			</button>

			<button
				className="edge-nav edge-nav-right"
				onClick={onNext}
				aria-label="Next pattern"
				title="Next"
			>
				<ArrowRight size={28} />
			</button>

			<div className="absolute inset-0 grid place-items-center px-16 pb-48 pt-24 sm:px-24">
				<motion.div
					key={pattern.slug}
					className="grid w-full max-w-[34rem] place-items-center text-center"
					initial={{ opacity: 0, x: 18 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: -18 }}
				>
					<div className="grid h-32 w-32 place-items-center rounded-full bg-[color-mix(in_srgb,var(--pattern-accent)_18%,transparent)] sm:h-40 sm:w-40">
						<div className="h-24 w-24 rounded-full bg-[var(--pattern-accent)] opacity-90 sm:h-28 sm:w-28" />
					</div>
					<p className="mt-8 text-sm uppercase tracking-[0.14em] text-[var(--muted)]">
						{pattern.category}
					</p>
					<h1 className="mt-2 min-h-24 text-balance text-4xl font-semibold leading-tight sm:min-h-28 sm:text-5xl">
						{pattern.name}
					</h1>
					<p className="mt-3 min-h-12 max-w-96 text-balance text-base leading-6 text-[var(--muted)] sm:text-lg">
						{pattern.description}
					</p>
					<div className="mt-3 min-h-16 w-full max-w-[30rem]">
						{pattern.caution ? (
							<p className="rounded-md bg-[color-mix(in_srgb,var(--background)_70%,transparent)] p-3 text-sm leading-5 text-[var(--foreground)] shadow-sm">
								{pattern.caution}
							</p>
						) : null}
					</div>
				</motion.div>
			</div>

			<div className="fixed bottom-[6.15rem] left-1/2 z-20 flex -translate-x-1/2 justify-center gap-2">
				{patterns.map((item, index) => (
					<button
						key={item.slug}
						className={`h-2.5 rounded-full transition-all ${index === patternIndex ? 'w-7 bg-[var(--foreground)]' : 'w-2.5 bg-[color-mix(in_srgb,var(--foreground)_28%,transparent)]'}`}
						onClick={() => onSelectPattern(index)}
						aria-label={`Select ${item.name}`}
					/>
				))}
			</div>

			<div className="fixed bottom-5 left-1/2 z-20 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2">
				<button className="primary-button" onClick={onStart}>
					Start
				</button>
			</div>

			{settingsOpen ? (
				<SettingsSheet
					preference={preference}
					onClose={onCloseSettings}
					onPreferenceChange={onPreferenceChange}
				/>
			) : null}
		</motion.section>
	);
}

function SettingsSheet({
	preference,
	onClose,
	onPreferenceChange,
}: {
	preference: LocalPreference;
	onClose: () => void;
	onPreferenceChange: (preference: LocalPreference) => void;
}) {
	return (
		<div className="fixed inset-0 z-10 bg-black/20" onClick={onClose}>
			<motion.div
				className="absolute bottom-0 left-0 right-0 rounded-t-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl sm:left-auto sm:right-5 sm:top-20 sm:h-fit sm:w-80 sm:rounded-lg"
				onClick={event => event.stopPropagation()}
				initial={{ y: 80, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				exit={{ y: 80, opacity: 0 }}
			>
				<div className="mb-5 flex items-center justify-between">
					<h2 className="text-lg font-semibold">Preferences</h2>
					<button
						className="icon-button"
						onClick={onClose}
						aria-label="Close settings"
						title="Close"
					>
						<X size={18} />
					</button>
				</div>

				<div className="space-y-5">
					<div>
						<p className="mb-2 text-sm text-[var(--muted)]">Theme</p>
						<div className="grid grid-cols-3 gap-2">
							{(['system', 'light', 'dark'] as const).map(theme => (
								<button
									key={theme}
									className={`segmented ${preference.theme === theme ? 'segmented-active' : ''}`}
									onClick={() => onPreferenceChange({ ...preference, theme })}
								>
									{theme === 'system' ? (
										'Auto'
									) : theme === 'light' ? (
										<Sun size={17} />
									) : (
										<Moon size={17} />
									)}
								</button>
							))}
						</div>
					</div>

					<ToggleRow
						icon={<Volume2 size={18} />}
						label="Sound"
						checked={preference.soundEnabled}
						onChange={() =>
							onPreferenceChange({
								...preference,
								soundEnabled: !preference.soundEnabled,
							})
						}
					/>
					<ToggleRow
						icon={<Waves size={18} />}
						label="Haptics"
						checked={preference.hapticsEnabled}
						onChange={() =>
							onPreferenceChange({
								...preference,
								hapticsEnabled: !preference.hapticsEnabled,
							})
						}
					/>
					<div>
						<p className="mb-2 text-sm text-[var(--muted)]">Session length</p>
						<div className="grid grid-cols-3 gap-2">
							{[3, 4, 5].map(minutes => (
								<button
									key={minutes}
									className={`segmented ${preference.sessionDurationMin === minutes ? 'segmented-active' : ''}`}
									onClick={() =>
										onPreferenceChange({
											...preference,
											sessionDurationMin: minutes,
										})
									}
								>
									{minutes}m
								</button>
							))}
						</div>
					</div>
					<div>
						<p className="mb-2 text-sm text-[var(--muted)]">Wim Hof rounds</p>
						<div className="grid grid-cols-2 gap-2">
							{([3, 4] as const).map(rounds => (
								<button
									key={rounds}
									className={`segmented ${preference.wimHofRounds === rounds ? 'segmented-active' : ''}`}
									onClick={() =>
										onPreferenceChange({ ...preference, wimHofRounds: rounds })
									}
								>
									{rounds}
								</button>
							))}
						</div>
					</div>
				</div>
			</motion.div>
		</div>
	);
}

function ToggleRow({
	icon,
	label,
	checked,
	onChange,
}: {
	icon: React.ReactNode;
	label: string;
	checked: boolean;
	onChange: () => void;
}) {
	return (
		<label className="flex items-center justify-between">
			<span className="flex items-center gap-3 text-sm">
				{icon}
				{label}
			</span>
			<button
				className={`relative h-7 w-12 rounded-full transition ${checked ? 'bg-[var(--foreground)]' : 'bg-[var(--border)]'}`}
				onClick={onChange}
				aria-pressed={checked}
				type="button"
			>
				<span
					className={`absolute top-1 h-5 w-5 rounded-full bg-[var(--surface)] transition ${checked ? 'left-6' : 'left-1'}`}
				/>
			</button>
		</label>
	);
}

function SessionScreen({
	pattern,
	preference,
	onFinish,
}: {
	pattern: BreathPattern;
	preference: LocalPreference;
	onFinish: (durationSec: number, completed: boolean) => void;
}) {
	const startedAtRef = useRef(Date.now());
	const [phaseIndex, setPhaseIndex] = useState(0);
	const [phaseElapsed, setPhaseElapsed] = useState(0);
	const [roundIndex, setRoundIndex] = useState(0);
	const phaseCount = pattern.phases.length;
	const safePhaseIndex = phaseCount > 0 ? phaseIndex % phaseCount : 0;
	const phase = pattern.phases[safePhaseIndex] ?? pattern.phases[0];
	const elapsedTotal = Math.max(0, (Date.now() - startedAtRef.current) / 1000);
	const sessionPlan = getSessionPlan(pattern, preference);
	const phaseSeconds = phase.seconds ?? sessionPlan.variableHoldSec;
	const phaseRemaining = Math.max(0, Math.ceil(phaseSeconds - phaseElapsed));
	const totalRemaining = Math.max(0, Math.ceil(sessionPlan.targetSec - elapsedTotal));
	const progress = Math.min(100, (elapsedTotal / sessionPlan.targetSec) * 100);
	const statusText =
		pattern.slug === 'wimhof'
			? `Round ${Math.min(roundIndex + 1, sessionPlan.rounds)} of ${sessionPlan.rounds} · ${formatDuration(totalRemaining)} left`
			: `${formatDuration(totalRemaining)} left`;

	const playTone = useCallback((type: string) => {
		const AudioContextClass = window.AudioContext || window.webkitAudioContext;
		const context = new AudioContextClass();
		const oscillator = context.createOscillator();
		const gain = context.createGain();
		const frequency = type === 'inhale' ? 440 : type === 'exhale' ? 300 : 360;

		oscillator.type = 'sine';
		oscillator.frequency.value = frequency;
		gain.gain.setValueAtTime(0, context.currentTime);
		gain.gain.linearRampToValueAtTime(0.045, context.currentTime + 0.025);
		gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22);
		oscillator.connect(gain);
		gain.connect(context.destination);
		oscillator.start();
		oscillator.stop(context.currentTime + 0.24);
	}, []);

	useEffect(() => {
		setPhaseElapsed(0);
		if (preference.soundEnabled) playTone(phase.type);
		if (preference.hapticsEnabled && 'vibrate' in navigator)
			navigator.vibrate(40);
	}, [
		safePhaseIndex,
		phase.type,
		playTone,
		preference.hapticsEnabled,
		preference.soundEnabled,
	]);

	useEffect(() => {
		const interval = window.setInterval(() => {
			setPhaseElapsed(elapsed => {
				const nextElapsed = elapsed + 0.1;
				const nextTotalElapsed = (Date.now() - startedAtRef.current) / 1000;

				if (nextTotalElapsed >= sessionPlan.targetSec) {
					window.clearInterval(interval);
					onFinish(Math.round(nextTotalElapsed), true);
					return 0;
				}

				if (nextElapsed >= phaseSeconds) {
					const isLastPhase = safePhaseIndex >= phaseCount - 1;
					const isLastRound =
						pattern.slug !== 'wimhof' || roundIndex >= sessionPlan.rounds - 1;

					if (pattern.slug === 'wimhof' && isLastPhase && isLastRound) {
						window.clearInterval(interval);
						onFinish(
							Math.round((Date.now() - startedAtRef.current) / 1000),
							true,
						);
					} else if (isLastPhase) {
						setPhaseIndex(0);
						if (pattern.slug === 'wimhof') {
							setRoundIndex(index => index + 1);
						}
					} else {
						setPhaseIndex(safePhaseIndex + 1);
					}
					return 0;
				}
				return nextElapsed;
			});
		}, 100);

		return () => window.clearInterval(interval);
	}, [
		onFinish,
		phaseCount,
		pattern.slug,
		phaseSeconds,
		roundIndex,
		safePhaseIndex,
		sessionPlan.rounds,
		sessionPlan.targetSec,
	]);

	const finishNow = () =>
		onFinish(
			Math.round((Date.now() - startedAtRef.current) / 1000),
			elapsedTotal > 0,
		);

	return (
		<motion.section
			className="relative flex min-h-screen items-center justify-center overflow-hidden px-6"
			style={getPatternVars(pattern)}
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
		>
			<button
				className="absolute right-5 top-5 z-10 grid h-11 w-11 place-items-center text-[var(--foreground)]"
				onClick={finishNow}
				aria-label="End session"
				title="End"
			>
				<X size={24} />
			</button>

			<div className="text-center">
				<motion.div
					className="mx-auto grid h-56 w-56 place-items-center rounded-full bg-[var(--pattern-bg)] sm:h-72 sm:w-72"
					animate={{ scale: circleScale[phase.type] }}
					transition={{ duration: phase.seconds ?? 8, ease: 'easeInOut' }}
				>
					<div className="grid h-36 w-36 place-items-center rounded-full bg-[var(--pattern-accent)] text-center text-xl font-semibold text-white shadow-lg sm:h-44 sm:w-44">
						{phase.label}
					</div>
				</motion.div>
				<p className="mt-8 text-lg text-[var(--foreground)]">{statusText}</p>
				<p className="mt-2 text-sm text-[var(--muted)]">
					{phase.label} · {phaseRemaining}s
				</p>
			</div>

			<div className="absolute bottom-0 left-0 h-1 w-full bg-[var(--border)]">
				<motion.div
					className="h-full bg-[var(--pattern-accent)]"
					style={{ width: `${progress}%` }}
				/>
			</div>
		</motion.section>
	);
}

function EndScreen({
	session,
	pattern,
	onMood,
	onHome,
}: {
	session: LocalSession;
	pattern: BreathPattern;
	onMood: (mood: number) => void;
	onHome: () => void;
}) {
	return (
		<motion.section
			className="flex min-h-screen items-center justify-center px-6"
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -12 }}
		>
			<div className="w-full max-w-sm text-center">
				<div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-[var(--surface)]">
					<Check size={30} />
				</div>
				<h1 className="text-3xl font-semibold">
					{formatDuration(session.durationSec)}
				</h1>
				<p className="mt-2 text-[var(--muted)]">{pattern.name}</p>

				<div className="my-9">
					<p className="mb-3 text-sm text-[var(--muted)]">
						How do you feel now?
					</p>
					<div className="flex justify-center gap-2">
						{[1, 2, 3, 4, 5].map(mood => (
							<button
								key={mood}
								className={`grid h-11 w-11 place-items-center rounded-full border border-[var(--border)] ${session.moodAfter === mood ? 'bg-[var(--foreground)] text-[var(--background)]' : 'bg-transparent'}`}
								onClick={() => onMood(mood)}
							>
								{mood}
							</button>
						))}
					</div>
				</div>

				<button className="primary-button" onClick={onHome}>
					Home
				</button>
			</div>
		</motion.section>
	);
}

function HistoryScreen({
	sessions,
	onHome,
}: {
	sessions: LocalSession[];
	onHome: () => void;
}) {
	const completed = sessions.filter(session => session.completed);
	const streak = computeStreak(sessions);
	const dayCounts = useMemo(() => {
		const counts = new Map<string, number>();
		for (const session of completed) {
			const key = toLocalDateKey(new Date(session.startedAt));
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		return counts;
	}, [completed]);
	const days = useMemo(() => {
		const today = new Date();
		return Array.from({ length: 84 }, (_, index) => {
			const date = new Date(
				today.getFullYear(),
				today.getMonth(),
				today.getDate() - (83 - index),
			);
			const key = toLocalDateKey(date);
			return { key, count: dayCounts.get(key) ?? 0 };
		});
	}, [dayCounts]);

	return (
		<motion.section
			className="min-h-screen px-5 py-5 sm:px-8"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
		>
			<button
				className="icon-button"
				onClick={onHome}
				aria-label="Back home"
				title="Back"
			>
				<ArrowLeft size={20} />
			</button>
			<div className="mx-auto mt-12 max-w-2xl">
				<h1 className="text-3xl font-semibold">History</h1>
				<div className="mt-6 grid grid-cols-2 gap-3">
					<Metric label="Streak" value={`${streak} days`} />
					<Metric label="Total sessions" value={String(completed.length)} />
				</div>
				<div className="mt-8">
					<div className="grid grid-flow-col grid-rows-7 justify-start gap-1 overflow-x-auto pb-2">
						{days.map(day => (
							<div
								key={day.key}
								className="h-4 w-4 rounded-[3px]"
								title={`${day.key}: ${day.count} sessions`}
								style={{
									background:
										day.count === 0
											? 'var(--border)'
											: day.count === 1
												? '#9BC17C'
												: day.count === 2
													? '#5FC2A2'
													: '#5B8DEF',
								}}
							/>
						))}
					</div>
				</div>
			</div>
		</motion.section>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
			<p className="text-sm text-[var(--muted)]">{label}</p>
			<p className="mt-1 text-2xl font-semibold">{value}</p>
		</div>
	);
}

function getPatternVars(pattern: BreathPattern) {
	return {
		'--pattern-bg': `var(--pattern-${pattern.slug}-bg)`,
		'--pattern-accent': `var(--pattern-${pattern.slug}-accent)`,
	} as React.CSSProperties;
}

function getSessionPlan(pattern: BreathPattern, preference: LocalPreference) {
	const variableHoldSec = 30;

	if (pattern.slug === 'wimhof') {
		const roundDuration = pattern.phases.reduce(
			(total, phase) => total + (phase.seconds ?? variableHoldSec),
			0,
		);

		return {
			rounds: preference.wimHofRounds,
			targetSec: roundDuration * preference.wimHofRounds,
			variableHoldSec,
		};
	}

	return {
		rounds: 1,
		targetSec: preference.sessionDurationMin * 60,
		variableHoldSec,
	};
}

function applyTheme(theme: LocalPreference['theme']) {
	if (theme === 'system') {
		document.documentElement.removeAttribute('data-theme');
	} else {
		document.documentElement.dataset.theme = theme;
	}
}

function formatDuration(seconds: number) {
	const minutes = Math.floor(seconds / 60);
	const remaining = seconds % 60;
	if (minutes === 0) return `${remaining}s`;
	return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

declare global {
	interface Window {
		webkitAudioContext?: typeof AudioContext;
	}
}
