import React, { useState, useEffect, useRef } from "react";
import { voiceApi } from "../api/client";
import { useToast } from "../App";

declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

export default function VoiceButton() {
    const [listening, setListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [response, setResponse] = useState("");
    const [show, setShow] = useState(false);
    const recognitionRef = useRef<any>(null);
    const { showToast } = useToast();

    useEffect(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return;

        const recognition = new SR();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => { setListening(true); setShow(true); setTranscript("Listening..."); };
        recognition.onresult = (e: any) => {
            const t = Array.from(e.results).map((r: any) => r[0].transcript).join("");
            setTranscript(t);
        };
        recognition.onerror = () => { setListening(false); setTranscript(""); };
        recognition.onend = async () => {
            setListening(false);
            const finalTranscript = recognitionRef.current?.lastTranscript;
            if (finalTranscript?.trim()) {
                setTranscript(`You: "${finalTranscript}"`);
                try {
                    const { data } = await voiceApi.send(finalTranscript);
                    setResponse(data.response || "Got it!");
                    setTranscript(`You: "${finalTranscript}"`);
                    // Text-to-speech response
                    const utterance = new SpeechSynthesisUtterance(data.response);
                    utterance.rate = 0.95;
                    utterance.pitch = 1.0;
                    window.speechSynthesis.speak(utterance);
                    setTimeout(() => { setShow(false); setTranscript(""); setResponse(""); }, 6000);
                } catch {
                    setResponse("Sorry, I had trouble processing that.");
                }
            } else {
                setShow(false);
            }
        };

        recognitionRef.current = recognition;
    }, []);

    const toggleVoice = () => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { showToast("Voice not supported in this browser. Try Chrome."); return; }

        if (listening) {
            recognitionRef.current?.stop();
        } else {
            recognitionRef.current.lastTranscript = "";
            recognitionRef.current?.start();
            // Capture the final transcript before onend
            recognitionRef.current.onresult = (e: any) => {
                const t = Array.from(e.results).map((r: any) => r[0].transcript).join("");
                setTranscript(t);
                recognitionRef.current.lastTranscript = t;
            };
        }
    };

    return (
        <>
            {show && (
                <div className="voice-transcript">
                    {transcript && <div style={{ marginBottom: 8, color: "var(--text-secondary)", fontSize: 13 }}>{transcript}</div>}
                    {response && (
                        <div style={{ color: "var(--accent-green)", fontWeight: 600 }}>
                            🤖 {response}
                        </div>
                    )}
                </div>
            )}
            <button
                id="voice-btn"
                className={`voice-btn ${listening ? "listening" : ""}`}
                onClick={toggleVoice}
                title={listening ? "Stop listening" : "Push to talk"}
                aria-label="Voice command button"
            >
                {listening ? "🔴" : "🎤"}
            </button>
        </>
    );
}
