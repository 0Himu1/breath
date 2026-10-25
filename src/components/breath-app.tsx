'use client';

import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import gsap from 'gsap';
import {
	ArrowLeft,
	ArrowRight,
	BarChart3,
	Check,
	Moon,
	Pause,
	Play,
	Settings2,
	Sun,
	Volume2,
	Waves,
	X,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { patterns, type BreathPattern } from '@/lib/patterns';
import { BreathVisual, PhaseRail } from '@/components/breath-visual';
import { breathMoment } from '@/lib/breath-motion';
import { SessionScreen } from '@/components/session-screen';
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

export function BreathApp() {
	const [view, setView] = useState<View>('home');
	const [preference, setPreference] =
		useState<LocalPreference>(defaultPreference);
	const [sessions, setSessions] = useState<LocalSession[]>([]);
	const [patternIndex, setPatternIndex] = useState(0);
	const patternChosen = useRef(false);
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
			if (!patternChosen.current) setPatternIndex(
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
		patternChosen.current = true;
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
		<MotionConfig reducedMotion="user"><main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
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
						onSelectPattern={index => { patternChosen.current = true; setPatternIndex(index); }}
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
		</main></MotionConfig>
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
	const [previewPaused, setPreviewPaused] = useState(false);
	const [previewTime, setPreviewTime] = useState(0);
	const [animatedIcon, setAnimatedIcon] = useState<string | null>(null);
	const [starting, setStarting] = useState(false);
	const startingRef = useRef(false);
	const homeRoot = useRef<HTMLElement>(null);
	const startMotion = useRef<gsap.Context | null>(null);
	const previewMoment = breathMoment(pattern, previewTime);
	useEffect(() => { setPreviewTime(0); }, [pattern.slug]);
	useEffect(() => () => { startMotion.current?.revert(); }, []);
	const beginSession = () => {
		if (startingRef.current) return;
		startingRef.current = true;
		setStarting(true);
		startMotion.current = gsap.context(() => {
			const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			gsap.timeline({ onComplete: onStart })
				.to('.breath-preview-art', { scale: reduced ? 1 : 1.07, opacity: 0, duration: reduced ? 0.12 : 0.28, ease: 'power2.inOut' })
				.to('.breath-home-content h1, .breath-home-content p, .phase-rail, .preview-toggle, .pattern-picker', { opacity: 0, duration: 0.18 }, 0)
				.to('.breath-start-control', { opacity: 0, duration: 0.16 }, 0.05);
		}, homeRoot);
	};

	return (
		<motion.section
			ref={homeRoot}
			inert={starting}
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

			<div className="breath-home-content">
				<motion.div
					key={pattern.slug}
					className="grid w-full max-w-[34rem] place-items-center text-center"
					initial={{ opacity: 0, x: 18 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: -18 }}
				>
					<div className="breath-preview-art"><BreathVisual key={pattern.slug} pattern={pattern} playing={!previewPaused && !settingsOpen && !starting} onTime={setPreviewTime} /></div>
					<h1 className="mt-4 text-balance text-3xl font-semibold leading-tight sm:text-4xl">
						{pattern.name}
					</h1>
					<p className="mt-3 max-w-96 text-balance text-base leading-6 text-[var(--muted)] sm:text-lg">
						{pattern.description}
					</p>
					<PhaseRail pattern={pattern} activeIndex={previewMoment.index} />
					<button className="preview-toggle" onClick={() => setPreviewPaused(value => !value)} aria-pressed={previewPaused}>
						{previewPaused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
						{previewPaused ? 'Play preview' : 'Pause preview'}
					</button>
					<div className="mt-3 min-h-16 w-full max-w-[30rem]">
						{pattern.caution ? (
							<p className="rounded-md bg-[color-mix(in_srgb,var(--background)_70%,transparent)] p-3 text-sm leading-5 text-[var(--foreground)] shadow-sm">
								{pattern.caution}
							</p>
						) : null}
					</div>
				</motion.div>
			</div>

			<div className="pattern-picker" aria-label="Breathing patterns">
				{patterns.map((item, index) => (
					<button
						key={item.slug}
						className={`pattern-choice ${index === patternIndex ? 'pattern-choice-active' : ''}`}
						style={getPatternVars(item)}
						onClick={() => onSelectPattern(index)}
						aria-label={`Select ${item.name}`}
						aria-pressed={index === patternIndex}
						title={item.name}
						onMouseEnter={() => setAnimatedIcon(item.slug)}
						onMouseLeave={() => setAnimatedIcon(null)}
						onFocus={() => setAnimatedIcon(item.slug)}
						onBlur={() => setAnimatedIcon(null)}
					><BreathVisual pattern={item} miniature={animatedIcon !== item.slug} /></button>
				))}
			</div>

			<div className="breath-start-control fixed bottom-5 left-1/2 z-20 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2">
				<button className="primary-button" onClick={beginSession} disabled={starting}>
					{starting ? 'Starting' : 'Start'}
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
	const panel = useRef<HTMLDivElement>(null);
	const [leaving, setLeaving] = useState(false);
	const exitMotion = useRef<gsap.core.Timeline | null>(null);
	useLayoutEffect(() => {
		const context = gsap.context(() => {
			const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			gsap.timeline({ onComplete: () => panel.current?.querySelector<HTMLHeadingElement>('h1')?.focus({ preventScroll: true }) })
				.fromTo('.end-symbol', { scale: reduced ? 1 : 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: reduced ? 0.15 : 0.4, ease: 'power3.out' })
				.fromTo('.end-detail', { y: reduced ? 0 : 7, opacity: 0 }, { y: 0, opacity: 1, duration: 0.24, stagger: reduced ? 0 : 0.05, ease: 'power2.out' }, 0.08);
		}, panel);
		return () => { exitMotion.current?.kill(); context.revert(); };
	}, []);
	const closeSummary = () => {
		if (leaving || !panel.current) return;
		setLeaving(true);
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		exitMotion.current = gsap.timeline({ onComplete: onHome })
			.to(panel.current, { opacity: 0, scale: reduced ? 1 : 0.98, duration: reduced ? 0.12 : 0.22, ease: 'power2.inOut' });
	};
	return (
		<motion.section
			className="flex min-h-screen items-center justify-center bg-[var(--pattern-bg)] px-6"
			style={getPatternVars(pattern)}
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
		>
			<div ref={panel} inert={leaving} className="w-full max-w-sm text-center">
				<div className="end-symbol mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-[var(--surface)]">
					{session.completed ? <Check size={30} aria-hidden="true" /> : <Waves size={30} aria-hidden="true" />}
				</div>
				<h1 tabIndex={-1} className="end-detail text-3xl font-semibold">
					{session.completed ? 'Session complete' : 'Session ended'}
				</h1>
				<p className="end-detail mt-3 text-xl tabular-nums">{formatDuration(session.durationSec)}</p>
				<p className="end-detail mt-2 text-[var(--muted)]">{pattern.name}</p>

				<div className="end-detail my-9">
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

				<button className="end-detail primary-button" onClick={closeSummary} disabled={leaving}>
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
