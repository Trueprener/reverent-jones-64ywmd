import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { FaCamera, FaVideo, FaMicrophone, FaPaperPlane } from "react-icons/fa";
import "./styles.css";

// ТВОИ НАСТРОЙКИ (Вставь сюда то, что мы копировали)
const supabaseUrl = "https://spprswurdabtwsajvlqp.supabase.co";
const supabaseKey = "sb_publishable_wF0M-rcqD1_CVboQ5yalCQ_gHbB8eV4";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [userName, setUserName] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isLoggedIn) return;

    // Загрузка
    supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data);
      });

    // Подписка
    const channel = supabase
      .channel("public:messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLoggedIn]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (userName.trim()) {
      localStorage.setItem("familyChatUser", userName);
      setIsLoggedIn(true);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    await supabase
      .from("messages")
      .insert([{ text: newMessage, sender: userName, type: "text" }]);
    setNewMessage("");
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileName = `${Date.now()}_${file.name.replace(
      /[^a-zA-Z0-9.]/g,
      "_"
    )}`;

    await supabase.storage.from("chat-files").upload(fileName, file);
    const { data } = supabase.storage.from("chat-files").getPublicUrl(fileName);

    await supabase
      .from("messages")
      .insert([{ sender: userName, type, url: data.publicUrl }]);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) =>
        audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const fileName = `audio_${Date.now()}.webm`;
        await supabase.storage.from("chat-files").upload(fileName, blob);
        const { data } = supabase.storage
          .from("chat-files")
          .getPublicUrl(fileName);
        await supabase
          .from("messages")
          .insert([{ sender: userName, type: "audio", url: data.publicUrl }]);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) {
      alert("Нет микрофона");
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="login-screen">
        <h1>🏠 Вход</h1>
        <form onSubmit={handleLogin}>
          <input
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Кто вы?"
          />
          <button type="submit">Войти</button>
        </form>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h2>Семья 💬</h2>
      </header>
      <div className="messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message ${msg.sender === userName ? "mine" : ""}`}
          >
            <strong>{msg.sender}</strong>
            {msg.type === "text" && <p>{msg.text}</p>}
            {msg.type === "photo" && <img src={msg.url} width="200" />}
            {msg.type === "audio" && <audio src={msg.url} controls />}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="input-area">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="..."
        />
        <button onClick={sendMessage}>
          <FaPaperPlane />
        </button>
        <label>
          <FaCamera />
          <input
            type="file"
            onChange={(e) => handleFileUpload(e, "photo")}
            hidden
          />
        </label>
        <button
          onMouseDown={startRecording}
          onMouseUp={() => mediaRecorderRef.current?.stop()}
        >
          <FaMicrophone />
        </button>
      </div>
    </div>
  );
}
