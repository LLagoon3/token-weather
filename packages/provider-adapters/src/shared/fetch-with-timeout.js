/**
 * fetch wrapper adding AbortController-based timeout.
 *
 * 네트워크가 막힌 환경(프록시/방화벽)에서 provider 호출이 무한 대기하지 않도록
 * 기본 15초 타임아웃을 적용한다.
 *
 * timeout에 걸리면 fetch는 표준 'AbortError'로 실패한다. 호출자는 보통의 fetch
 * 실패와 동일하게 처리하면 된다.
 *
 * Caller가 직접 AbortController.signal을 전달했다면 그 signal도 존중된다
 * (두 신호 중 하나라도 abort되면 요청 중단).
 *
 * @param {typeof fetch} fetchImpl
 * @param {RequestInfo} input
 * @param {RequestInit & { timeoutMs?: number }} [init]
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(fetchImpl, input, init = {}) {
  const { timeoutMs = 15_000, signal: externalSignal, ...rest } = init;

  if (!timeoutMs || timeoutMs <= 0) {
    return fetchImpl(input, { ...rest, signal: externalSignal });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new Error(`request timed out after ${timeoutMs}ms`)),
    timeoutMs,
  );

  // external signal과 연결: 외부 abort 시 내부 controller도 abort
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId);
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(externalSignal.reason), {
        once: true,
      });
    }
  }

  try {
    return await fetchImpl(input, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
