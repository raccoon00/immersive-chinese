<script lang="ts">
	import { onMount } from 'svelte';
	import { getBoundingBox, polylineLength } from '$lib/drawing/geometry';
	import { processStroke } from '$lib/drawing/strokeProcessing';
	import type { Point } from '$lib/drawing/types';
	import { getTargetCharacter } from '$lib/hanzi/loadHanziData';
	import type { UserCharacterAttempt, UserStroke } from '$lib/practice/types';
	import type { StrokeMatchStatus } from '$lib/validation/types';

	const CANVAS_SIZE = 320;
	const MIN_STROKE_POINTS = 2;

	type LogEvent = (event: string, payload: unknown) => Promise<void> | void;

	type Props = {
		attemptId: string;
		initialCharacter: UserCharacterAttempt;
		characterIndex?: number;
		onLogEvent: LogEvent;
		onCharacterChange?: (character: UserCharacterAttempt) => void;
		targetChar?: string;
		targetBackgroundColor?: string;
		committedStrokeStatuses?: Array<StrokeMatchStatus | undefined>;
	};

	type ActiveStroke = {
		pointerId: number;
		pointerType: string;
		startedAt: number;
		rawPoints: Point[];
		normalizedPoints: Point[];
	};

	let {
		attemptId,
		initialCharacter,
		characterIndex = 0,
		onLogEvent,
		onCharacterChange = () => {},
		targetChar,
		targetBackgroundColor = '#d4d4d8',
		committedStrokeStatuses = []
	}: Props = $props();

	const targetCharacter = $derived(targetChar ? getTargetCharacter(targetChar) : undefined);

	let canvas = $state<HTMLCanvasElement | null>(null);
	let character = $state<UserCharacterAttempt>({ id: 'active-character', strokes: [] });
	let activeStroke = $state<ActiveStroke | null>(null);
	let lastSyncedCharacterId = $state('');

	function emitCharacterChange(nextCharacter: UserCharacterAttempt): void {
		character = nextCharacter;
		onCharacterChange(nextCharacter);
	}

	function syncCanvasSize(): void {
		if (!canvas) {
			return;
		}

		const pixelRatio = window.devicePixelRatio || 1;
		canvas.width = Math.round(CANVAS_SIZE * pixelRatio);
		canvas.height = Math.round(CANVAS_SIZE * pixelRatio);
	}

	function canvasPointToNormalized(point: Point, width: number, height: number): Point {
		return {
			x: width === 0 ? 0 : point.x / width,
			y: height === 0 ? 0 : point.y / height,
			t: point.t,
			pressure: point.pressure
		};
	}

	function eventToCanvasPoint(event: PointerEvent): Point | null {
		if (!canvas) {
			return null;
		}

		const rect = canvas.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) {
			return null;
		}

		return {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top,
			t: performance.now(),
			pressure: event.pressure
		};
	}

	function drawStroke(
		ctx: CanvasRenderingContext2D,
		points: Point[],
		strokeStyle: string,
		lineWidth: number,
		width: number,
		height: number
	): void {
		if (points.length === 0) {
			return;
		}

		ctx.beginPath();
		ctx.strokeStyle = strokeStyle;
		ctx.lineWidth = lineWidth;
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';
		ctx.moveTo(points[0].x * width, points[0].y * height);

		for (let i = 1; i < points.length; i += 1) {
			ctx.lineTo(points[i].x * width, points[i].y * height);
		}

		if (points.length === 1) {
			ctx.lineTo(points[0].x * width + 0.001, points[0].y * height + 0.001);
		}

		ctx.stroke();
	}

	function committedStrokeColor(status: StrokeMatchStatus | undefined): string {
		switch (status) {
			case 'matched':
				return '#22c55e';
			case 'bad_shape':
				return '#eab308';
			case 'wrong_direction':
				return '#a855f7';
			case 'wrong_order':
			case 'extra':
				return '#ef4444';
			default:
				return '#18181b';
		}
	}

	function drawCanvas(): void {
		if (!canvas) {
			return;
		}

		const ctx = canvas.getContext('2d');
		if (!ctx) {
			return;
		}

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		for (const [index, stroke] of character.strokes.entries()) {
			drawStroke(
				ctx,
				stroke.processed ?? stroke.points,
				committedStrokeColor(committedStrokeStatuses[index]),
				10,
				canvas.width,
				canvas.height
			);
		}

		if (activeStroke) {
			drawStroke(ctx, activeStroke.normalizedPoints, '#2563eb', 8, canvas.width, canvas.height);
		}
	}

	function updateCharacterStrokes(nextStrokes: UserStroke[]): void {
		emitCharacterChange({
			...character,
			strokes: nextStrokes
		});
	}

	function finishStroke(reason?: 'pointercancel' | 'too_few_points'): void {
		if (!activeStroke || !canvas) {
			return;
		}

		const strokeIndex = character.strokes.length;
		const rawPoints = activeStroke.rawPoints;
		const normalizedPoints = activeStroke.normalizedPoints;
		const processedPoints = processStroke(normalizedPoints);

		if (reason || processedPoints.length < MIN_STROKE_POINTS) {
			void onLogEvent('stroke_cancelled', {
				attemptId,
				characterIndex,
				strokeIndex,
				reason: reason ?? 'too_few_points'
			});
			activeStroke = null;
			return;
		}

		const nextStroke: UserStroke = {
			points: normalizedPoints,
			processed: processedPoints
		};

		updateCharacterStrokes([...character.strokes, nextStroke]);

		void onLogEvent('stroke_committed', {
			attemptId,
			characterIndex,
			strokeIndex,
			pointerType: activeStroke.pointerType,
			rawPointCount: rawPoints.length,
			processedPointCount: processedPoints.length,
			rawBoundingBox: getBoundingBox(rawPoints),
			normalizedBoundingBox: getBoundingBox(normalizedPoints),
			length: polylineLength(processedPoints),
			durationMs: Math.round(performance.now() - activeStroke.startedAt),
			rawPoints,
			normalizedPoints,
			processedPoints
		});

		activeStroke = null;
	}

	function handlePointerDown(event: PointerEvent): void {
		if (!canvas || activeStroke) {
			return;
		}

		if (event.pointerType === 'mouse' && event.button !== 0) {
			return;
		}

		event.preventDefault();

		const rect = canvas.getBoundingClientRect();
		const canvasPoint = eventToCanvasPoint(event);
		if (!canvasPoint) {
			return;
		}

		const normalizedPoint = canvasPointToNormalized(canvasPoint, rect.width, rect.height);
		const strokeIndex = character.strokes.length;

		canvas.setPointerCapture(event.pointerId);
		activeStroke = {
			pointerId: event.pointerId,
			pointerType: event.pointerType,
			startedAt: performance.now(),
			rawPoints: [canvasPoint],
			normalizedPoints: [normalizedPoint]
		};

		void onLogEvent('stroke_started', {
			attemptId,
			characterIndex,
			strokeIndex,
			pointerType: event.pointerType,
			canvasSize: { width: rect.width, height: rect.height },
			startPoint: {
				x: canvasPoint.x,
				y: canvasPoint.y
			},
			pressure: event.pressure
		});
	}

	function handlePointerMove(event: PointerEvent): void {
		if (!canvas || !activeStroke || activeStroke.pointerId !== event.pointerId) {
			return;
		}

		event.preventDefault();

		const rect = canvas.getBoundingClientRect();
		const canvasPoint = eventToCanvasPoint(event);
		if (!canvasPoint) {
			return;
		}

		const normalizedPoint = canvasPointToNormalized(canvasPoint, rect.width, rect.height);
		activeStroke = {
			...activeStroke,
			rawPoints: [...activeStroke.rawPoints, canvasPoint],
			normalizedPoints: [...activeStroke.normalizedPoints, normalizedPoint]
		};
	}

	function handlePointerUp(event: PointerEvent): void {
		if (!canvas || !activeStroke || activeStroke.pointerId !== event.pointerId) {
			return;
		}

		event.preventDefault();

		const rect = canvas.getBoundingClientRect();
		const canvasPoint = eventToCanvasPoint(event);
		if (canvasPoint) {
			const normalizedPoint = canvasPointToNormalized(canvasPoint, rect.width, rect.height);
			activeStroke = {
				...activeStroke,
				rawPoints: [...activeStroke.rawPoints, canvasPoint],
				normalizedPoints: [...activeStroke.normalizedPoints, normalizedPoint]
			};
		}

		if (canvas.hasPointerCapture(event.pointerId)) {
			canvas.releasePointerCapture(event.pointerId);
		}

		finishStroke();
	}

	function handlePointerCancel(event: PointerEvent): void {
		if (!canvas || !activeStroke || activeStroke.pointerId !== event.pointerId) {
			return;
		}

		if (canvas.hasPointerCapture(event.pointerId)) {
			canvas.releasePointerCapture(event.pointerId);
		}

		finishStroke('pointercancel');
	}

	function undoLastStroke(): void {
		if (character.strokes.length === 0) {
			return;
		}

		const removedStrokeIndex = character.strokes.length - 1;
		const nextStrokes = character.strokes.slice(0, -1);
		updateCharacterStrokes(nextStrokes);

		void onLogEvent('undo_stroke_pressed', {
			attemptId,
			characterIndex,
			removedStrokeIndex,
			remainingStrokeCount: nextStrokes.length
		});
	}

	function clearCharacter(): void {
		if (character.strokes.length === 0 && !activeStroke) {
			return;
		}

		const removedStrokeCount = character.strokes.length;
		activeStroke = null;
		updateCharacterStrokes([]);

		void onLogEvent('clear_character_pressed', {
			attemptId,
			characterIndex,
			removedStrokeCount
		});
	}

	function syncInitialCharacter(): void {
		character = {
			id: initialCharacter.id,
			strokes: [...initialCharacter.strokes]
		};
		activeStroke = null;
		lastSyncedCharacterId = initialCharacter.id;
	}

	onMount(() => {
		syncInitialCharacter();
		syncCanvasSize();
		window.addEventListener('resize', syncCanvasSize);

		return () => {
			window.removeEventListener('resize', syncCanvasSize);
		};
	});

	$effect(() => {
		if (initialCharacter.id !== lastSyncedCharacterId) {
			syncInitialCharacter();
		}
	});

	$effect(() => {
		drawCanvas();
	});
</script>

<div class="space-y-4">
	<div
		class="relative h-80 w-80 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200"
	>
		{#if targetCharacter}
			<svg viewBox="0 0 1024 1024" class="pointer-events-none absolute inset-0 h-full w-full">
				<g transform="translate(0 900) scale(1 -1)">
					{#each targetCharacter.strokes as stroke (stroke.index)}
						<path d={stroke.svgPath} fill={targetBackgroundColor} fill-opacity="0.45" />
					{/each}
				</g>
			</svg>
		{/if}

		<div
			class="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-zinc-300"
		></div>
		<div
			class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-zinc-300"
		></div>

		<canvas
			bind:this={canvas}
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			onpointercancel={handlePointerCancel}
			class="absolute inset-0 block h-80 w-80 touch-none"
		></canvas>
	</div>

	<div class="flex flex-wrap gap-3">
		<button
			type="button"
			onclick={undoLastStroke}
			class="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-200"
		>
			Undo stroke
		</button>
		<button
			type="button"
			onclick={clearCharacter}
			class="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-200"
		>
			Clear current
		</button>
	</div>
</div>
