const supabase = require("../../config/supabase");

exports.getAiSummary = async (req, res) => {
  try {
    const chatLimit = 20;

    if (req.user.id === "guest" || req.user.id === "00000000-0000-0000-0000-000000000000" || req.user.role === "GUEST") {
      return res.status(200).json({
        status: "success",
        data: {
          chatLimit,
          chatsUsed: 0,
          chatsRemaining: chatLimit,
          tokensConsumed: 0,
        },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: usage, error } = await supabase
      .from("ai_usage_logs")
      .select("chat_count, tokens_consumed")
      .eq("user_id", req.user.id)
      .eq("usage_date", today)
      .maybeSingle();

    if (error) throw error;

    const chatsUsed = Math.max(0, Number(usage?.chat_count || 0));
    return res.status(200).json({
      status: "success",
      data: {
        chatLimit: 20,
        chatsUsed,
        chatsRemaining: Math.max(0, 20 - chatsUsed),
        tokensConsumed: Math.max(0, Number(usage?.tokens_consumed || 0)),
      },
    });
  } catch (error) {
    console.error("getAiSummary error:", error);
    return res.status(500).json({
      status: "error",
      message: "Could not load AI usage summary.",
    });
  }
};
