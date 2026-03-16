import { useState, useCallback, useRef, useEffect } from "react";
import { playKeyClick } from "./key-clicks";

const TYPING_SEQUENCES = [
  { text: "best trading strategies in 2026", pauseAfter: 1200 },
  { text: "how do i reach consistency?", pauseAfter: 1200 },
  { text: "finding my edge that makes me profitable", pauseAfter: 1200 },
  { text: "profitabledge.com", pauseAfter: 800 },
];

const TYPE_SPEED = 45;
const DELETE_SPEED = 25;
const INITIAL_DELAY = 1500;

export { TYPING_SEQUENCES };

export function useTypewriter(onComplete: () => void) {
  const [displayText, setDisplayText] = useState("");
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef({
    text: "",
    seqIdx: 0,
    deleting: false,
    done: false,
  });
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const tick = useCallback(() => {
    const s = stateRef.current;
    if (s.done) return;
    const current = TYPING_SEQUENCES[s.seqIdx];
    if (!current) return;

    const isLastSequence = s.seqIdx === TYPING_SEQUENCES.length - 1;

    if (!s.deleting) {
      if (s.text.length < current.text.length) {
        s.text = current.text.slice(0, s.text.length + 1);
        setDisplayText(s.text);
        playKeyClick();
        timeoutRef.current = setTimeout(tick, TYPE_SPEED);
      } else {
        if (isLastSequence) {
          timeoutRef.current = setTimeout(() => {
            s.done = true;
            setIsDone(true);
            onCompleteRef.current();
          }, current.pauseAfter);
        } else {
          timeoutRef.current = setTimeout(() => {
            s.deleting = true;
            tick();
          }, current.pauseAfter);
        }
      }
    } else {
      if (s.text.length > 0) {
        s.text = s.text.slice(0, -1);
        setDisplayText(s.text);
        playKeyClick();
        timeoutRef.current = setTimeout(tick, DELETE_SPEED);
      } else {
        s.deleting = false;
        s.seqIdx += 1;
        setSequenceIndex(s.seqIdx);
        timeoutRef.current = setTimeout(tick, 300);
      }
    }
  }, []);

  useEffect(() => {
    timeoutRef.current = setTimeout(tick, INITIAL_DELAY);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [tick]);

  const skip = useCallback(() => {
    stateRef.current.done = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsDone(true);
  }, []);

  return { displayText, isDone, sequenceIndex, skip };
}
