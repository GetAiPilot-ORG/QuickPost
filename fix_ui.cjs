const fs = require('fs');

// 1. Fix DashboardLayout.jsx
let layout = fs.readFileSync('client/src/components/DashboardLayout.jsx', 'utf8');
layout = layout.replace(/100vh/g, '100dvh');
fs.writeFileSync('client/src/components/DashboardLayout.jsx', layout);

// 2. Fix SocialInboxPage.jsx
let code = fs.readFileSync('client/src/pages/SocialInboxPage.jsx', 'utf8');

// Fix 100vh
code = code.replace(/100vh/g, '100dvh');

// Replace Left Pane Style
code = code.replace(
  /\{\/\*[^\*]*Left Pane: Comment & Thread List[^\*]*\*\/\}[\s\S]*?width: "clamp\(280px, 22vw, 320px\)",[\s\S]*?minHeight: 0,\s*\}\}\s*>/,
  `{/* ── Left Pane: Comment & Thread List ── */}
          <div
            className={\`w-full md:w-[320px] md:max-w-[320px] flex-shrink-0 border-r border-[#d3cec6] bg-white min-h-0 \${selectedItem ? "hidden md:flex" : "flex"} flex-col\`}
          >`
);

// Add ArrowLeft import if missing
if (!code.includes('ArrowLeft')) {
  code = code.replace('ChevronRight,', 'ChevronRight,\n  ArrowLeft,');
}

// Replace Right Pane
const startToken = '{/* ── Right Pane: Thread Detail & Reply Composer ── */}';
const endToken = 'Select a conversation to start chatting</div>\\n              </div>\\n            </div>\\n          )}';
// Let's use string indices to be absolutely bulletproof.
const splitA = code.indexOf(startToken);

// Find the exact ending. We know it ends with `Select a conversation to start chatting</div>` then two `</div>` and a `)}`
const searchStr = 'Select a conversation to start chatting</div>';
let splitB = code.indexOf(searchStr);
if (splitB !== -1) {
  // Find the first )} after it
  splitB = code.indexOf(')}', splitB) + 2; 
}

if (splitA === -1 || splitB === -1 || splitB < splitA) {
  console.error("Could not find Right Pane boundaries!");
  process.exit(1);
}

const newRightPane = `{/* ── Right Pane: Thread Detail & Reply Composer ── */}
          <div className={\`\${!selectedItem ? "hidden md:flex" : "flex"} flex-1 flex-col h-full overflow-hidden\`} style={{ background: "#ffffff" }}>
            {selectedItem ? (
              <div style={{ display: "flex", flexDirection: "column", flex: 1, width: "100%", maxWidth: 900, margin: "0 auto", height: "100%", overflow: "hidden", background: "#ffffff", borderLeft: "1px solid rgba(0,0,0,0.06)", borderRight: "1px solid rgba(0,0,0,0.06)" }}>
                
                {/* ── Instagram-Style Header ── */}
                <div style={{ background: "#ffffff", padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, zIndex: 10 }}>
                  <button onClick={() => setSelectedItemId(null)} className="md:hidden flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-slate-100" style={{ color: "var(--ink)", border: "none", background: "transparent", cursor: "pointer" }}>
                    <ArrowLeft size={24} strokeWidth={2} />
                  </button>
                  <AuthorAvatar src={selectedItem.authorAvatar} name={selectedItem.authorName} size={40} />
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: "1.2" }}>
                      {selectedItem.authorName}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--slate)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      {selectedItem.authorHandle} • <img src={getPlatformIcon(selectedItem.platform)} style={{ width: 12, height: 12 }} alt="" title={selectedItem.platform} />
                    </div>
                  </div>
                </div>

                {/* ── Chat Messages Area ── */}
                <div className="no-scrollbar" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 6, marginTop: "auto" }}>
                    
                    {/* Post Context Embedded Card */}
                    <div style={{ alignSelf: "center", maxWidth: "85%", width: "100%", background: "#f8f9fa", borderRadius: 16, padding: 12, marginBottom: 24, border: "1px solid rgba(0,0,0,0.05)", display: "flex", gap: 12, alignItems: "center" }}>
                      <PostThumbnailImage src={selectedItem.postThumbnail} platform={selectedItem.platform} postId={selectedItem.postId} size={56} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--slate)", textTransform: "capitalize", marginBottom: 2 }}>Replying to {selectedItem.platform} Post</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{selectedItem.postTitle}</div>
                      </div>
                    </div>

                    {/* Original Message and Replies */}
                    {(selectedItem.replies?.length > 0 ? selectedItem.replies : [selectedItem]).map((msg, idx, arr) => {
                      const isSelf = msg.isSelf || false;
                      const rawText = msg.text || selectedItem.text || "";
                      const msgText = rawText.trim() === "" ? "[📸 Media Attachment]" : rawText;
                      const nextMsg = arr[idx + 1];
                      const isLastInGroup = !nextMsg || nextMsg.isSelf !== isSelf;

                      return (
                        <div key={msg.id || idx} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexDirection: isSelf ? "row-reverse" : "row", width: "100%", marginBottom: isLastInGroup ? 16 : 2 }}>
                          {!isSelf && (
                            <div style={{ flexShrink: 0, width: 28, height: 28 }}>
                              {isLastInGroup && (
                                <AuthorAvatar src={selectedItem.authorAvatar} name={selectedItem.authorName} size={28} />
                              )}
                            </div>
                          )}
                          <div style={{ display: "flex", flexDirection: "column", alignItems: isSelf ? "flex-end" : "flex-start", maxWidth: "75%" }}>
                            <div
                              style={{
                                background: isSelf ? "var(--arc, #ff5600)" : "#efefef",
                                color: isSelf ? "#ffffff" : "var(--ink)",
                                padding: "10px 16px",
                                borderRadius: 22,
                                borderBottomRightRadius: isSelf && isLastInGroup ? 4 : 22,
                                borderBottomLeftRadius: !isSelf && isLastInGroup ? 4 : 22,
                                fontSize: 15,
                                lineHeight: 1.4,
                                wordBreak: "break-word"
                              }}
                            >
                              {msgText}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Composer Area ── */}
                <div style={{ background: "#ffffff", padding: "12px 16px 24px", flexShrink: 0, zIndex: 10, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                  
                  {/* Copilot Suggestions */}
                  <div className="no-scrollbar" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--arc)", display: "flex", alignItems: "center", gap: 4, flexShrink: 0, paddingRight: 4 }}>
                      <Sparkles size={14} /> AI
                    </div>
                    {["Friendly", "Professional", "Quick Thanks"].map(mood => (
                      <button
                        key={mood}
                        onClick={() => handleAiCopilot(mood.toLowerCase().replace(" ", "_"))}
                        disabled={generatingAi}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 20,
                          background: "#f1f5f9",
                          border: "none",
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--ink)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flexShrink: 0,
                          transition: "background 0.2s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#e2e8f0"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "#f1f5f9"}
                      >
                        {generatingAi ? <Loader2 size={12} className="animate-spin" /> : mood}
                      </button>
                    ))}
                  </div>

                  {replyErrorMsg && (
                    <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                      <AlertCircle size={14} /> {replyErrorMsg}
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "flex-end", gap: 10, background: "#f1f5f9", padding: "10px 16px", borderRadius: 24 }}>
                    <textarea
                      rows={1}
                      placeholder="Message..."
                      value={replyText}
                      onChange={(e) => {
                        setReplyText(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = \`\${Math.min(e.target.scrollHeight, 120)}px\`;
                      }}
                      style={{
                        flex: 1,
                        border: "none",
                        outline: "none",
                        resize: "none",
                        fontSize: 15,
                        fontFamily: "inherit",
                        background: "transparent",
                        padding: "4px 0",
                        maxHeight: 120,
                        color: "var(--ink)",
                        lineHeight: 1.4
                      }}
                    />
                    {replyText.trim() ? (
                      <button
                        onClick={handleSendReply}
                        disabled={sendingReply}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--link, #0095f6)",
                          fontSize: 15,
                          fontWeight: 700,
                          cursor: sendingReply ? "default" : "pointer",
                          padding: "4px 4px 4px 12px",
                          flexShrink: 0,
                          transition: "opacity 0.2s",
                          opacity: sendingReply ? 0.5 : 1
                        }}
                      >
                        {sendingReply ? <Loader2 size={18} className="animate-spin" /> : "Send"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--slate)" }}>
                <div style={{ textAlign: "center" }}>
                  <MessagesSquare size={64} strokeWidth={1} style={{ margin: "0 auto 16px", color: "var(--ink)" }} />
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>Your Messages</div>
                  <div style={{ fontSize: 14, marginTop: 8 }}>Select a conversation to start chatting</div>
                </div>
              </div>
            )}`;

const newCode = code.substring(0, splitA) + newRightPane + code.substring(splitB);
fs.writeFileSync('client/src/pages/SocialInboxPage.jsx', newCode);
console.log('Successfully rewrote SocialInboxPage.jsx');
