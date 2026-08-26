import { getSupabaseAdmin, logError, logInfo } from "./db.ts";
import {
  isTokenExpiredError,
  refreshIGLongLivedToken,
  sendInstagramGenericTemplate,
  sendInstagramImage,
  sendInstagramCommentReply,
  sendInstagramPrivateReplyImage,
  sendInstagramPrivateReplyGenericTemplate,
  sendInstagramPrivateReplyPayload,
  sendInstagramTextPayload,
  isInstagramOutsideAllowedWindowError,
  type InstagramGenericTemplateElement,
} from "./metaService.ts";
import { decryptTokenBundle, encryptTokenBundle } from "./tokenService.ts";
import {
  applyDeliveryBranding,
  getDeliveryPlan,
  stripBrandingWatermark,
} from "./deliveryPolicy.ts";
import { syncSocialContactToEcosystemSoon } from "./ecosystemContactSync.ts";

interface AutomationRecord {
  id: string;
  name?: string;
  user_id?: string;
  keywords: string[];
  trigger_type: string;
  instagram_account_id: string;
  media_id?: string;
  comment_reply_enabled?: boolean;
  comment_reply_text?: string | null;
  require_follow?: boolean;
  fallback_comment_reply?: string | null;
  response_flow: ResponseFlow | string;
  schedule_type?: "manual" | "duration" | "custom" | string;
  starts_at?: string | null;
  ends_at?: string | null;
  expired_at?: string | null;
}

interface ResponseFlowButton {
  id?: string;
  type?: "url" | "postback";
  title?: string;
  url?: string;
  payload?: string;
}

interface FormField {
  id?: string;
  type?: string;
  label?: string;
  required?: boolean;
}

interface CarouselItem {
  id?: string;
  title?: string;
  subtitle?: string;
  image_url?: string;
  buttons?: ResponseFlowButton[];
}

interface ResponseFlowNode {
  id?: string;
  type?: string;
  content?: string;
  text?: string;
  image_url?: string;
  buttons?: ResponseFlowButton[];
  form_fields?: FormField[];
  card_title?: string;
  card_subtitle?: string;
  card_image_url?: string;
  items?: CarouselItem[];
  carousel_items?: CarouselItem[];
  delay_seconds?: number;
}

interface ResponseFlow {
  nodes?: ResponseFlowNode[];
  opening_message_enabled?: boolean;
  opening_message?: string;
  opening_button?: string;
}

interface SenderProfile {
  username: string;
  firstName: string;
  fullName: string;
  profilePictureUrl?: string;
  followerCount?: number | null;
  isFollowingYou?: boolean | null;
  youAreFollowing?: boolean | null;
}

const getSenderProfile = (payload: AutomationInput): SenderProfile => {
  const fallbackUsername = `user_${payload.senderId}`;
  let username = "";
  let fullName = "";

  try {
    const ep = payload.externalPayload || {};
    username =
      ep.value?.from?.username ||
      ep.sender?.username ||
      ep.from?.username ||
      ep.message?.from?.username ||
      "";
    fullName =
      ep.value?.from?.name ||
      ep.sender?.name ||
      ep.from?.name ||
      ep.message?.from?.name ||
      "";
  } catch (e) {
    /* ignore extraction errors, fallback already set */
  }

  const cleanUsername = String(username || fallbackUsername)
    .replace(/^@+/, "")
    .trim();
  const cleanFullName = String(fullName || "").trim();
  const firstName =
    cleanFullName.split(/\s+/).filter(Boolean)[0] ||
    (cleanUsername && cleanUsername !== fallbackUsername
      ? cleanUsername
      : "there");

  return {
    username: cleanUsername !== fallbackUsername ? cleanUsername : "",
    firstName,
    fullName: cleanFullName || firstName,
  };
};

interface InstagramScopedUserProfile {
  name?: string;
  username?: string;
  profile_pic?: string;
  follower_count?: number;
  is_user_follow_business?: boolean;
  is_business_follow_user?: boolean;
}

const fetchInstagramScopedUserProfile = async (
  senderId: string,
  accessToken: string,
  requestId?: string,
): Promise<InstagramScopedUserProfile | null> => {
  if (!senderId || !accessToken) return null;

  const url = new URL(`https://graph.instagram.com/v24.0/${senderId}`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set(
    "fields",
    "name,username,profile_pic,follower_count,is_user_follow_business,is_business_follow_user",
  );

  try {
    const response = await fetch(url.toString());
    const json = await response.json().catch(() => ({}));
    
    // TEMPORARY LOGGING FOR DEBUGGING
    logInfo("Graph API response for scoped profile", {
      requestId,
      senderId,
      json
    });

    if (!response.ok || json?.error) {
      throw new Error(
        json?.error?.message ||
          `Instagram scoped profile failed (${response.status})`,
      );
    }
    return json;
  } catch (error) {
    logInfo("Instagram scoped user profile unavailable", {
      requestId,
      senderId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

const mergeSenderProfile = (
  profile: SenderProfile,
  scopedProfile: InstagramScopedUserProfile | null,
): SenderProfile => {
  if (!scopedProfile) return profile;

  const username = cleanText(scopedProfile.username) || profile.username;
  const fullName = cleanText(scopedProfile.name) || profile.fullName;
  const firstName =
    fullName.split(/\s+/).filter(Boolean)[0] || username || profile.firstName;

  return {
    username,
    firstName,
    fullName,
    profilePictureUrl:
      cleanText(scopedProfile.profile_pic) || profile.profilePictureUrl,
    followerCount:
      typeof scopedProfile.follower_count === "number"
        ? scopedProfile.follower_count
        : profile.followerCount,
    isFollowingYou:
      typeof scopedProfile.is_user_follow_business === "boolean"
        ? scopedProfile.is_user_follow_business
        : profile.isFollowingYou,
    youAreFollowing:
      typeof scopedProfile.is_business_follow_user === "boolean"
        ? scopedProfile.is_business_follow_user
        : profile.youAreFollowing,
  };
};

const enrichSenderProfileFromContact = async (
  instagramAccountId: string,
  senderId: string,
  profile: SenderProfile,
): Promise<SenderProfile> => {
  if (
    profile.username &&
    profile.firstName !== "there" &&
    profile.profilePictureUrl
  )
    return profile;

  const supabase = getSupabaseAdmin();
  const { data: contact } = await supabase
    .from("contacts")
    .select(
      "username, full_name, profile_picture_url, follower_count, is_following_you, you_are_following",
    )
    .eq("instagram_account_id", instagramAccountId)
    .eq("instagram_user_id", senderId)
    .maybeSingle();

  const username = cleanText(contact?.username);
  const hasRealUsername = username && username !== `user_${senderId}`;
  const fullName = cleanText(contact?.full_name);
  const firstName =
    fullName.split(/\s+/).filter(Boolean)[0] ||
    (hasRealUsername ? username : profile.firstName);

  return {
    username: hasRealUsername ? username : profile.username,
    firstName: firstName || profile.firstName,
    fullName: fullName || firstName || profile.fullName,
    profilePictureUrl:
      cleanText(contact?.profile_picture_url) || profile.profilePictureUrl,
    followerCount:
      typeof contact?.follower_count === "number"
        ? contact.follower_count
        : profile.followerCount,
    isFollowingYou:
      typeof contact?.is_following_you === "boolean"
        ? contact.is_following_you
        : profile.isFollowingYou,
    youAreFollowing:
      typeof contact?.you_are_following === "boolean"
        ? contact.you_are_following
        : profile.youAreFollowing,
  };
};

const renderMessageTemplate = (
  text: string,
  profile: SenderProfile,
): string => {
  const variables: Record<string, string> = {
    first_name: profile.firstName,
    firstname: profile.firstName,
    name: profile.fullName,
    full_name: profile.fullName,
    username: profile.username,
  };

  return text.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (match, key: string) => {
      const value = variables[key.toLowerCase()];
      return value || "";
    },
  );
};

type MessageAction =
  | {
      type: "text";
      text: string;
      quickReplies?: Array<{
        content_type: "text";
        title: string;
        payload: string;
      }>;
    }
  | { type: "image"; imageUrl: string }
  | { type: "template"; elements: InstagramGenericTemplateElement[] }
  | { type: "delay"; seconds: number };

const resolveDeliveryPlan = async (userId: string) => {
  const supabase = getSupabaseAdmin();
  const now = Date.now();

  try {
    let email: string | null = null;
    let userProfilePlan: string | null = null;
    let userProfileStatus: string | null = null;

    // 1. Check users profile by id
    const { data: userProfile } = await supabase
      .from("users")
      .select("email,plan,subscription_status")
      .eq("id", userId)
      .maybeSingle();

    if (userProfile) {
      email = userProfile.email;
      userProfilePlan = userProfile.plan;
      userProfileStatus = userProfile.subscription_status;
    } else {
      // Fallback: check auth.users by id to find the user's email
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(userId);
        if (authUser?.user?.email) {
          email = authUser.user.email;
          const { data: userByEmail } = await supabase
            .from("users")
            .select("plan,subscription_status")
            .eq("email", email)
            .maybeSingle();
          if (userByEmail) {
            userProfilePlan = userByEmail.plan;
            userProfileStatus = userByEmail.subscription_status;
          }
        }
      } catch (authErr) {
        logInfo("Auth admin lookup skipped", { userId });
      }
    }

    // 2. Check Central Hub subscriptions by email
    let hubSubs: any[] = [];
    if (email) {
      const { data: hData } = await supabase
        .from("hub_subscriptions")
        .select("plan,plan_id,subscription_status,expires_at")
        .eq("email", email)
        .in("subscription_status", ["active", "trialing"]);
      hubSubs = (hData || []).map((s) => ({
        plan_id: s.plan_id || s.plan,
        status: s.subscription_status,
        current_period_end: s.expires_at,
      }));
    }

    // 3. Add user profile plan
    const userSubs: any[] = [];
    if (userProfilePlan) {
      userSubs.push({
        plan_id: userProfilePlan,
        status: userProfileStatus || "active",
      });
    }

    const combined = [...hubSubs, ...userSubs];
    const plan = getDeliveryPlan(combined, now);
    logInfo("Resolved delivery plan", {
      userId,
      email,
      combinedCount: combined.length,
      planId: plan.id,
    });
    return plan;
  } catch (error: any) {
    logError("Entitlement lookup failed; applying Free plan delivery rules", {
      userId,
      error: error?.message || String(error),
    });
    return { id: "free", replyLimit: 50 };
  }
};

const reserveMonthlyAutoDmReply = async (userId: string, limit: number) => {
  const now = new Date();
  const periodStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);
  const periodEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  )
    .toISOString()
    .slice(0, 10);
  const { data, error } = await getSupabaseAdmin().rpc(
    "consume_entitlement_usage",
    {
      p_user_id: userId,
      p_metric: "autodm_replies_per_month",
      p_amount: 1,
      p_limit: limit,
      p_period_start: periodStart,
      p_period_end: periodEnd,
    },
  );
  if (error)
    throw new Error(`Unable to reserve Auto-DM reply quota: ${error.message}`);
  return data?.[0]?.allowed === true;
};

const normalizeFlow = (automation: AutomationRecord): ResponseFlow | null => {
  let flow = automation.response_flow;
  if (typeof flow === "string") {
    try {
      flow = JSON.parse(flow);
    } catch (e) {
      return null;
    }
  }

  return flow && typeof flow === "object" ? flow : null;
};

const cleanText = (value?: string | null) => String(value || "").trim();

const buildButtonLines = (buttons?: ResponseFlowButton[]): string[] =>
  (buttons ?? [])
    .map((button) => {
      const title = cleanText(button.title);
      if (!title) return "";

      if (button.type === "url" && cleanText(button.url)) {
        return `${title}: ${cleanText(button.url)}`;
      }

      return title;
    })
    .filter(Boolean);

const buildQuickReplies = (
  buttons?: ResponseFlowButton[],
):
  | Array<{ content_type: "text"; title: string; payload: string }>
  | undefined => {
  const quickReplies = (buttons ?? [])
    .filter((button) => button.type === "postback" && cleanText(button.title))
    .slice(0, 13)
    .map((button) => ({
      content_type: "text" as const,
      title: cleanText(button.title).slice(0, 20),
      payload: cleanText(button.payload) || cleanText(button.title),
    }));

  return quickReplies.length ? quickReplies : undefined;
};

const buildCardText = (
  title?: string | null,
  subtitle?: string | null,
  buttons?: ResponseFlowButton[],
): string => {
  const parts = [
    cleanText(title),
    cleanText(subtitle),
    ...buildButtonLines(buttons),
  ];
  return parts.filter(Boolean).join("\n");
};

const buildTemplateButtons = (
  buttons?: ResponseFlowButton[],
): InstagramGenericTemplateElement["buttons"] => {
  const templateButtons = (buttons ?? [])
    .map((button) => {
      const title = cleanText(button.title).slice(0, 20);
      if (!title) return null;

      if (button.type === "url" && cleanText(button.url)) {
        return {
          type: "web_url" as const,
          title,
          url: cleanText(button.url),
        };
      }

      return {
        type: "postback" as const,
        title,
        payload: cleanText(button.payload) || title,
      };
    })
    .filter((button): button is NonNullable<typeof button> => Boolean(button))
    .slice(0, 3);

  return templateButtons.length ? templateButtons : undefined;
};

const buildTemplateElement = (
  title?: string | null,
  subtitle?: string | null,
  imageUrl?: string | null,
  buttons?: ResponseFlowButton[],
): InstagramGenericTemplateElement | null => {
  let cleanTitle = cleanText(title);
  let cleanSubtitle = cleanText(subtitle);

  // If title is longer than 80 chars, split it into title and subtitle (max 80 each)
  if (cleanTitle.length > 80) {
    if (!cleanSubtitle) {
      cleanSubtitle = cleanTitle.slice(80, 160).trim();
    }
    cleanTitle = cleanTitle.slice(0, 80).trim();
  } else {
    cleanTitle = cleanTitle || "Details";
    cleanSubtitle = cleanSubtitle.slice(0, 80);
  }

  const cleanImageUrl = cleanText(imageUrl);
  const templateButtons = buildTemplateButtons(buttons);

  if (
    !cleanTitle &&
    !cleanSubtitle &&
    !cleanImageUrl &&
    !templateButtons?.length
  ) {
    return null;
  }

  return {
    title: cleanTitle,
    ...(cleanSubtitle ? { subtitle: cleanSubtitle } : {}),
    ...(cleanImageUrl ? { image_url: cleanImageUrl } : {}),
    ...(templateButtons ? { buttons: templateButtons } : {}),
  };
};

const buildResponseActions = (
  automation: AutomationRecord,
  profile: SenderProfile,
  startNodeIndex = 0,
  includeOpening = true,
): MessageAction[] => {
  const flow = normalizeFlow(automation);
  if (!flow) return [];

  const actions: MessageAction[] = [];

  if (
    includeOpening &&
    flow.opening_message_enabled &&
    cleanText(flow.opening_message)
  ) {
    if (flow.opening_button) {
      const msgText = renderMessageTemplate(
        cleanText(flow.opening_message),
        profile,
      );
      actions.push({
        type: "template",
        elements: [
          {
            title: msgText,
            buttons: [
              {
                type: "postback",
                title: flow.opening_button,
                payload: flow.opening_button,
              },
            ],
          },
        ],
      });
      return actions; // Stop processing further nodes, wait for user reply
    } else {
      actions.push({
        type: "text",
        text: renderMessageTemplate(cleanText(flow.opening_message), profile),
      });
    }
  }

  for (const node of (flow.nodes ?? []).slice(startNodeIndex)) {
    switch (node.type) {
      case "text": {
        const text = renderMessageTemplate(
          cleanText(node.content || node.text),
          profile,
        );
        if (!text) break;

        const hasUrlButton = (node.buttons ?? []).some(
          (button) => button.type === "url" && cleanText(button.url),
        );

        if (hasUrlButton) {
          const element = buildTemplateElement(text, null, null, node.buttons);
          if (element) actions.push({ type: "template", elements: [element] });
          break;
        }

        const quickReplies = buildQuickReplies(node.buttons);
        actions.push({
          type: "text",
          text,
          quickReplies,
        });
        if (quickReplies && quickReplies.length > 0) {
          return actions; // Wait for user to click button before sending subsequent nodes
        }
        break;
      }

      case "image": {
        if (cleanText(node.image_url)) {
          actions.push({ type: "image", imageUrl: cleanText(node.image_url) });
        }
        const caption = renderMessageTemplate(
          cleanText(node.content || node.text),
          profile,
        );
        if (caption) actions.push({ type: "text", text: caption });
        break;
      }

      case "buttons": {
        const message = renderMessageTemplate(
          cleanText(node.content || node.text) || "Choose an option:",
          profile,
        );
        const hasUrlButton = (node.buttons ?? []).some(
          (button) => button.type === "url" && cleanText(button.url),
        );

        if (hasUrlButton) {
          const element = buildTemplateElement(
            message,
            null,
            null,
            node.buttons,
          );
          if (element) actions.push({ type: "template", elements: [element] });
          break;
        }

        const quickReplies = buildQuickReplies(node.buttons);
        actions.push({
          type: "text",
          text: message,
          quickReplies,
        });
        if (quickReplies && quickReplies.length > 0) {
          return actions; // Wait for user to click button before sending subsequent nodes
        }
        break;
      }

      case "card": {
        const element = buildTemplateElement(
          renderMessageTemplate(cleanText(node.card_title), profile),
          renderMessageTemplate(cleanText(node.card_subtitle), profile),
          node.card_image_url,
          node.buttons,
        );
        if (element) actions.push({ type: "template", elements: [element] });
        break;
      }

      case "carousel": {
        const elements: InstagramGenericTemplateElement[] = [];
        for (const item of node.carousel_items ?? node.items ?? []) {
          const element = buildTemplateElement(
            renderMessageTemplate(cleanText(item.title), profile),
            renderMessageTemplate(cleanText(item.subtitle), profile),
            item.image_url,
            item.buttons,
          );
          if (element) elements.push(element);
        }
        if (elements.length)
          actions.push({ type: "template", elements: elements.slice(0, 10) });
        break;
      }

      case "form":
      case "lead_form": {
        const fields = (node.form_fields ?? [])
          .map((field) => cleanText(field.label))
          .filter(Boolean);
        const formTitle =
          cleanText((node as any).form_title) || "Please share your details";
        actions.push({
          type: "text",
          text: fields.length
            ? `${formTitle}:\n${fields.map((field) => `- ${field}`).join("\n")}`
            : formTitle,
        });
        break;
      }

      case "delay": {
        const seconds = Math.min(
          Math.max(Number(node.delay_seconds) || 1, 1),
          60,
        );
        actions.push({ type: "delay", seconds });
        break;
      }

      default: {
        const text = renderMessageTemplate(
          cleanText(node.content || node.text),
          profile,
        );
        if (text) actions.push({ type: "text", text });
      }
    }
  }

  if (
    includeOpening &&
    actions.length === 0 &&
    cleanText(flow.opening_message)
  ) {
    if (flow.opening_button) {
      const msgText = renderMessageTemplate(
        cleanText(flow.opening_message),
        profile,
      );
      actions.push({
        type: "template",
        elements: [
          {
            title: msgText,
            buttons: [
              {
                type: "postback",
                title: flow.opening_button,
                payload: flow.opening_button,
              },
            ],
          },
        ],
      });
    } else {
      actions.push({
        type: "text",
        text: renderMessageTemplate(cleanText(flow.opening_message), profile),
      });
    }
  }

  return actions;
};

const getFirstMessageText = (actions: MessageAction[]) =>
  actions.find(
    (action): action is Extract<MessageAction, { type: "text" }> =>
      action.type === "text",
  )?.text ?? "";

const prioritizePrivateReplyAction = (actions: MessageAction[]) => {
  const firstSendableIndex = actions.findIndex(
    (action) => action.type !== "delay",
  );
  if (firstSendableIndex === -1) return actions;

  const preferredIndex = actions.findIndex(
    (action) => action.type === "template" || action.type === "text",
  );
  if (preferredIndex === -1 || preferredIndex <= firstSendableIndex)
    return actions;

  const nextActions = [...actions];
  const [preferredAction] = nextActions.splice(preferredIndex, 1);
  nextActions.splice(firstSendableIndex, 0, preferredAction);
  return nextActions;
};

const getCommentPrivateReplyActions = (actions: MessageAction[]) => {
  const orderedActions = prioritizePrivateReplyAction(actions);
  const firstSendableIndex = orderedActions.findIndex(
    (action) => action.type !== "delay",
  );
  return firstSendableIndex === -1 ? [] : [orderedActions[firstSendableIndex]];
};

const buildExpectedKeywordsFromFirstNode = (
  automation: AutomationRecord,
): string[] => {
  const flow = normalizeFlow(automation);
  const firstNode = flow?.nodes?.[0];
  const buttonKeywords =
    firstNode?.buttons
      ?.map((button) => button.payload || button.title)
      .filter(Boolean)
      .map((keyword) => cleanText(keyword).toLowerCase()) ?? [];

  if (flow?.opening_button) {
    buttonKeywords.push(cleanText(flow.opening_button).toLowerCase());
  }

  return Array.from(new Set(["setup", ...buttonKeywords].filter(Boolean)));
};

const computeNextSessionState = (
  automation: AutomationRecord,
  startNodeIndex: number,
  includeOpening: boolean,
) => {
  const flow = normalizeFlow(automation);
  if (!flow) return null;

  if (
    includeOpening &&
    flow.opening_message_enabled &&
    cleanText(flow.opening_message) &&
    flow.opening_button
  ) {
    return {
      nextNodeIndex: 0,
      expectedKeywords: Array.from(
        new Set([
          "setup",
          cleanText(flow.opening_button).toLowerCase(),
        ].filter(Boolean)),
      ),
    };
  }

  const nodes = flow.nodes ?? [];
  for (let i = startNodeIndex; i < nodes.length; i++) {
    const node = nodes[i];
    const interactiveButtons = (node.buttons ?? []).filter(
      (b) => b.type !== "url" && (b.payload || b.title),
    );

    if (interactiveButtons.length > 0) {
      const buttonKeywords = interactiveButtons
        .flatMap((b) => [
          cleanText(b.payload || "").toLowerCase(),
          cleanText(b.title || "").toLowerCase(),
        ])
        .filter(Boolean);

      if (i + 1 < nodes.length) {
        return {
          nextNodeIndex: i + 1,
          expectedKeywords: Array.from(new Set(["setup", ...buttonKeywords])),
        };
      }
    }
  }

  return null;
};

const templateToFallbackText = (
  action: Extract<MessageAction, { type: "template" }>,
) =>
  action.elements
    .map((element) =>
      [
        cleanText(element.title),
        cleanText(element.subtitle),
        ...(element.buttons ?? []).map((button) =>
          button.type === "web_url" && cleanText(button.url)
            ? `${cleanText(button.title)}: ${cleanText(button.url)}`
            : `> Type "${cleanText(button.title)}" to continue`,
        ),
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .filter(Boolean)
    .join("\n\n");

const getLoggableOutboundAction = (actions: MessageAction[]) =>
  actions.find((action) => action.type !== "delay") ?? null;

const serializeMessageActionForLog = (action: MessageAction | null) => {
  if (!action) {
    return {
      messageType: "text",
      content: "",
      mediaUrl: null as string | null,
    };
  }

  if (action.type === "text") {
    return {
      messageType: "text",
      content: action.text,
      mediaUrl: null as string | null,
    };
  }

  if (action.type === "image") {
    return {
      messageType: "image",
      content: action.imageUrl,
      mediaUrl: action.imageUrl,
    };
  }

  if (action.type === "template") {
    return {
      messageType: "template",
      content: JSON.stringify({ elements: action.elements }),
      mediaUrl:
        action.elements.find((element) => cleanText(element.image_url))
          ?.image_url ?? null,
    };
  }

  return { messageType: "text", content: "", mediaUrl: null as string | null };
};

const sleep = (seconds: number) =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000));

interface InstagramAccountRecord {
  id: string;
  user_id: string;
  page_id: string;
  ig_id: string;
  webhook_ig_id?: string | null;
  access_token_encrypted: string;
  token_expires_at: string;
}

interface AutomationInput {
  igId: string;
  senderId: string;
  messageText: string;
  triggerType: string;
  dedupeKey: string;
  mediaId?: string;
  eventId?: string;
  requestId?: string;
  externalPayload?: any;
}

interface PendingAutomationSession {
  id: string;
  automation_id: string;
  instagram_account_id: string;
  contact_id?: string | null;
  sender_id: string;
  expected_keywords: string[];
  next_node_index: number;
}

const automationSelectFields =
  "id,name,user_id,keywords,response_flow,trigger_type,media_id,instagram_account_id,comment_reply_enabled,comment_reply_text,schedule_type,starts_at,ends_at,expired_at,require_follow,fallback_comment_reply";
const instagramAccountSelectFields =
  "id,user_id,page_id,ig_id:instagram_user_id,webhook_ig_id:webhook_instagram_user_id,access_token_encrypted,token_expires_at,is_connected";

const isAutomationRunnableNow = (
  automation: Partial<AutomationRecord>,
  now = new Date(),
) => {
  const startsAt = automation.starts_at ? new Date(automation.starts_at) : null;
  const endsAt = automation.ends_at ? new Date(automation.ends_at) : null;

  if (startsAt && startsAt.getTime() > now.getTime()) return false;
  if (endsAt && endsAt.getTime() <= now.getTime()) return false;
  return true;
};

const expireFinishedAutomations = async (
  automations: Array<Partial<AutomationRecord>>,
  requestId?: string,
) => {
  const expiredIds = automations
    .filter(
      (automation) =>
        automation.ends_at &&
        new Date(automation.ends_at).getTime() <= Date.now(),
    )
    .map((automation) => automation.id)
    .filter((id): id is string => Boolean(id));

  if (expiredIds.length === 0) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("automations")
    .update({
      is_active: false,
      expired_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in("id", expiredIds);

  if (error) {
    logError("Failed expiring finished automations", {
      requestId,
      expiredIds,
      error: error.message,
    });
  } else {
    logInfo("Expired finished automations", { requestId, expiredIds });
  }
};

const getAllMatchingAutomations = (
  automations: AutomationRecord[],
  messageText: string,
): AutomationRecord[] => {
  const normalizedText = (messageText || "").toLowerCase().trim();

  return automations.filter((automation) => {
    const keywords = automation.keywords || [];
    return keywords.some((k) => {
      const normalizedK = k.trim().toLowerCase();
      if (normalizedK === '*') return true;
      return normalizedK.length > 0 && normalizedText.includes(normalizedK);
    });
  });
};

// Legacy single-match helper kept for continuation session usage
const getMatchingAutomation = (
  automations: AutomationRecord[],
  messageText: string,
) => getAllMatchingAutomations(automations, messageText)[0] ?? null;


const getSessionKeywordMatches = (
  session: PendingAutomationSession,
  messageText: string,
) => {
  const normalizedText = cleanText(messageText).toLowerCase();
  const keywords = session.expected_keywords || [];
  return keywords.some((keyword) => {
    const normalizedKeyword = cleanText(keyword).toLowerCase();
    return normalizedKeyword && normalizedText.includes(normalizedKeyword);
  });
};

const getContinuationAutomation = async (
  instagramAccountId: string,
  senderId: string,
  messageText: string,
  requestId?: string,
) => {
  const supabase = getSupabaseAdmin();

  let { data: sessions, error: sessionError } = await supabase
    .from("automation_sessions")
    .select(
      "id,automation_id,instagram_account_id,contact_id,sender_id,expected_keywords,next_node_index",
    )
    .eq("instagram_account_id", instagramAccountId)
    .eq("sender_id", senderId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  // Fallback: If no sessions on exact account, search any pending session for this sender
  if ((!sessions || sessions.length === 0) && senderId) {
    const { data: fallbackSessions } = await supabase
      .from("automation_sessions")
      .select(
        "id,automation_id,instagram_account_id,contact_id,sender_id,expected_keywords,next_node_index",
      )
      .eq("sender_id", senderId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (fallbackSessions && fallbackSessions.length > 0) {
      sessions = fallbackSessions;
      logInfo("Found continuation session via senderId fallback", {
        requestId,
        senderId,
        fallbackAccountId: fallbackSessions[0].instagram_account_id,
        providedAccountId: instagramAccountId,
      });
    }
  }

  if (sessionError) {
    logError("Failed loading automation sessions", {
      requestId,
      instagramAccountId,
      senderId,
      error: sessionError.message,
    });
    return null;
  }

  const matchedSession = (sessions ?? []).find(
    (session: PendingAutomationSession) =>
      getSessionKeywordMatches(session, messageText),
  ) as PendingAutomationSession | undefined;

  if (!matchedSession) return null;

  const { data: automation, error: automationError } = await supabase
    .from("automations")
    .select(automationSelectFields)
    .eq("id", matchedSession.automation_id)
    .eq("is_active", true)
    .maybeSingle();

  if (automationError) {
    logError("Failed loading continuation automation", {
      requestId,
      sessionId: matchedSession.id,
      automationId: matchedSession.automation_id,
      error: automationError.message,
    });
    return null;
  }

  if (
    !automation ||
    String((automation as any).name || "").includes(" - DM Follow-up") ||
    !isAutomationRunnableNow(automation as AutomationRecord)
  ) {
    if (automation) {
      await expireFinishedAutomations(
        [automation as AutomationRecord],
        requestId,
      );
    }
    await supabase
      .from("automation_sessions")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", matchedSession.id);
    return null;
  }

  return {
    session: matchedSession,
    automation: automation as AutomationRecord,
  };
};

const checkRateLimit = async (igId: string, senderId: string) => {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("can_send_automated_reply", {
    p_ig_id: igId,
    p_sender_id: senderId,
    p_max_count: 5,
  });

  if (error) {
    throw new Error(`Rate limit check failed: ${error.message}`);
  }

  return Boolean(data);
};

const DIRECT_IG_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const DIRECT_IG_REFRESH_FALLBACK_MS = 60 * 1000;
const FACEBOOK_REFRESH_BUFFER_MS = 5 * 24 * 60 * 60 * 1000;
const TOKEN_USABLE_BUFFER_MS = 60 * 1000;

const getTokenExpiryMs = (tokenExpiresAt?: string | null) => {
  if (!tokenExpiresAt) return null;
  const value = new Date(tokenExpiresAt).getTime();
  return Number.isFinite(value) ? value : null;
};

const isAccountTokenUsable = (
  account: Pick<InstagramAccountRecord, "token_expires_at">,
) => {
  const expiryMs = getTokenExpiryMs(account.token_expires_at);
  return expiryMs !== null && expiryMs - Date.now() > TOKEN_USABLE_BUFFER_MS;
};

const markAccountDisconnected = async (
  account: InstagramAccountRecord,
  reason: string,
  requestId?: string,
) => {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const { error: accountError } = await supabase
    .from("instagram_accounts")
    .update({ is_connected: false, updated_at: nowIso })
    .eq("id", account.id);

  if (accountError) {
    logError("Failed marking Instagram account disconnected", {
      requestId,
      accountId: account.id,
      igId: account.ig_id,
      error: accountError.message,
    });
  }

  const { data: tokenRow } = await supabase
    .from("social_tokens")
    .select("profile_data")
    .eq("user_id", account.user_id)
    .eq("provider", "instagram")
    .maybeSingle();

  const { error: tokenError } = await supabase
    .from("social_tokens")
    .update({
      profile_data: {
        ...((tokenRow as any)?.profile_data || {}),
        token_status: "expired",
        token_error: reason,
        updated_by: "autodm_webhook",
      },
      updated_at: nowIso,
    })
    .eq("user_id", account.user_id)
    .eq("provider", "instagram");

  if (tokenError) {
    logError("Failed marking social Instagram token expired", {
      requestId,
      accountId: account.id,
      igId: account.ig_id,
      error: tokenError.message,
    });
  }
};

const refreshAccountTokenIfNeeded = async (
  account: InstagramAccountRecord,
  requestId?: string,
): Promise<{ pageAccessToken: string; userAccessToken: string }> => {
  const supabase = getSupabaseAdmin();
  const tokenBundle = await decryptTokenBundle(account.access_token_encrypted);
  if (!isAccountTokenUsable(account)) {
    const reason = "Instagram token expired. Please reconnect Instagram.";
    await markAccountDisconnected(account, reason, requestId);
    throw new Error(reason);
  }

  const expiresAt = new Date(account.token_expires_at);
  const expiryMs = expiresAt.getTime();
  const isDirectIg =
    tokenBundle.userAccessToken?.startsWith("IG") ||
    tokenBundle.userAccessToken?.startsWith("IGA");
  const refreshBufferMs = isDirectIg
    ? DIRECT_IG_REFRESH_BUFFER_MS
    : FACEBOOK_REFRESH_BUFFER_MS;
  const hasKnownExpiry = Number.isFinite(expiryMs);
  const msUntilExpiry = hasKnownExpiry
    ? expiryMs - Date.now()
    : Number.NEGATIVE_INFINITY;
  const needsRefresh = !hasKnownExpiry || msUntilExpiry < refreshBufferMs;

  if (!needsRefresh || !isDirectIg) {
    return tokenBundle;
  }

  try {
    const refreshed = await refreshIGLongLivedToken(
      tokenBundle.userAccessToken,
    );

    const newBundle = {
      pageAccessToken: refreshed.access_token,
      userAccessToken: refreshed.access_token,
    };

    const encrypted = await encryptTokenBundle(newBundle);
    const nextExpiry = new Date(
      Date.now() + (refreshed.expires_in ?? 60 * 24 * 60 * 60) * 1000,
    );

    const { error } = await supabase
      .from("instagram_accounts")
      .update({
        access_token_encrypted: encrypted,
        token_expires_at: nextExpiry.toISOString(),
      })
      .eq("id", account.id);

    if (error) {
      throw new Error(`Failed persisting refreshed token: ${error.message}`);
    }

    logInfo("Refreshed account token", {
      requestId,
      igId: account.ig_id,
      pageId: account.page_id,
    });

    return newBundle;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (hasKnownExpiry && msUntilExpiry > DIRECT_IG_REFRESH_FALLBACK_MS) {
      logError(
        "Direct Instagram token refresh failed; using still-valid token",
        {
          requestId,
          igId: account.ig_id,
          pageId: account.page_id,
          tokenExpiresAt: account.token_expires_at,
          minutesUntilExpiry: Math.round(msUntilExpiry / 60000),
          error: message,
        },
      );
      return tokenBundle;
    }

    const reason = `Instagram token expired or cannot be refreshed. Please reconnect Instagram. ${message}`;
    await markAccountDisconnected(account, reason, requestId);
    throw new Error(reason);
  }
};

export const processAutomationEvent = async (payload: AutomationInput) => {
  const supabase = getSupabaseAdmin();

  let { data: accounts, error: accountError } = await supabase
    .from("instagram_accounts")
    .select(
      "id,user_id,page_id,ig_id:instagram_user_id,webhook_ig_id:webhook_instagram_user_id,access_token_encrypted,token_expires_at,is_connected",
    )
    .or(
      `instagram_user_id.eq.${payload.igId},webhook_instagram_user_id.eq.${payload.igId}`,
    )
    .order("updated_at", { ascending: false });

  if (accountError) {
    throw new Error(`Failed loading account: ${accountError.message}`);
  }

  let webhookIgIdForSend = payload.igId;

  if (!accounts || accounts.length === 0) {
    logInfo(
      "No exact account found for incoming event; trying media automation mapping",
      {
        requestId: payload.requestId,
        igId: payload.igId,
        mediaId: payload.mediaId,
      },
    );

    if (payload.mediaId) {
      const { data: mediaAutomations, error: mediaAutomationError } =
        await supabase
          .from("automations")
          .select("instagram_account_id,starts_at,ends_at")
          .eq("is_active", true)
          .eq("media_id", payload.mediaId);

      if (mediaAutomationError) {
        throw new Error(
          `Failed loading media automation mapping: ${mediaAutomationError.message}`,
        );
      }

      await expireFinishedAutomations(
        (mediaAutomations ?? []) as any,
        payload.requestId,
      );
      const mappedAccountIds = Array.from(
        new Set(
          (mediaAutomations ?? [])
            .filter((a: any) => isAutomationRunnableNow(a))
            .map((a: any) => a.instagram_account_id)
            .filter(Boolean),
        ),
      );

      if (mappedAccountIds.length === 1) {
        const { data: mappedAccounts, error: mappedAccountError } =
          await supabase
            .from("instagram_accounts")
            .select(
              "id,user_id,page_id,ig_id:instagram_user_id,webhook_ig_id:webhook_instagram_user_id,access_token_encrypted,token_expires_at,is_connected",
            )
            .eq("id", mappedAccountIds[0])
            .limit(1);

        if (mappedAccountError) {
          throw new Error(
            `Failed loading mapped account: ${mappedAccountError.message}`,
          );
        }

        accounts = mappedAccounts;

        if (accounts?.[0]) {
          await supabase
            .from("instagram_accounts")
            .update({
              webhook_instagram_user_id: payload.igId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", (accounts[0] as any).id);

          logInfo("Mapped webhook igId to account via media automation", {
            requestId: payload.requestId,
            webhookIgId: payload.igId,
            mediaId: payload.mediaId,
            accountId: (accounts[0] as any).id,
            storedIgId: (accounts[0] as any).ig_id,
          });
        }
      } else if (mappedAccountIds.length > 1) {
        logError("Ambiguous media automation mapping for webhook igId", {
          requestId: payload.requestId,
          webhookIgId: payload.igId,
          mediaId: payload.mediaId,
          mappedAccountIds,
        });
      }
    }

    if (!accounts || accounts.length === 0) {
      const { data: fallbackAccounts, error: fallbackAccountError } =
        await supabase
          .from("instagram_accounts")
          .select(
            "id,user_id,page_id,ig_id:instagram_user_id,webhook_ig_id:webhook_instagram_user_id,access_token_encrypted,token_expires_at,is_connected",
          )
          .eq("is_connected", true)
          .order("updated_at", { ascending: false });

      if (fallbackAccountError) {
        throw new Error(
          `Failed loading single-account fallback: ${fallbackAccountError.message}`,
        );
      }

      if ((fallbackAccounts ?? []).length === 1) {
        accounts = fallbackAccounts;

        await supabase
          .from("instagram_accounts")
          .update({
            webhook_instagram_user_id: payload.igId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", (accounts[0] as any).id);

        logInfo("Mapped webhook igId using single connected account fallback", {
          requestId: payload.requestId,
          webhookIgId: payload.igId,
          accountId: (accounts[0] as any).id,
          storedIgId: (accounts[0] as any).ig_id,
        });
      } else if ((fallbackAccounts ?? []).length > 1) {
        logInfo(
          "Attempting self-healing webhook mapping for multiple accounts",
          {
            requestId: payload.requestId,
            webhookIgId: payload.igId,
          },
        );

        for (const account of fallbackAccounts ?? []) {
          try {
            const tokenBundle = await decryptTokenBundle(
              account.access_token_encrypted,
            );
            const token =
              tokenBundle.userAccessToken || tokenBundle.pageAccessToken;
            if (token && (token.startsWith("IG") || token.startsWith("IGA"))) {
              const res = await fetch(
                `https://graph.instagram.com/v24.0/${payload.igId}?fields=id,username&access_token=${token}`,
              );
              if (res.ok) {
                const data = await res.json();
                const storedIgId = account.ig_id || account.page_id;
                if (
                  data &&
                  (data.id === storedIgId ||
                    data.username === (account as any).instagram_username)
                ) {
                  // Clear duplicate webhook mappings first
                  await supabase
                    .from("instagram_accounts")
                    .update({ webhook_instagram_user_id: null })
                    .eq("webhook_instagram_user_id", payload.igId);

                  // Update matched account
                  await supabase
                    .from("instagram_accounts")
                    .update({
                      webhook_instagram_user_id: payload.igId,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", account.id);

                  (account as any).webhook_instagram_user_id = payload.igId;
                  accounts = [account];
                  logInfo(
                    "Self-healing successfully mapped webhook igId to account",
                    {
                      requestId: payload.requestId,
                      webhookIgId: payload.igId,
                      accountId: account.id,
                      username: (account as any).instagram_username,
                    },
                  );
                  break;
                }
              }
            }
          } catch (e) {
            logError("Self-healing mapping attempt failed for account", {
              requestId: payload.requestId,
              accountId: account.id,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      }
    }

    if (!accounts || accounts.length === 0) {
      logInfo("No account found for incoming event", {
        requestId: payload.requestId,
        igId: payload.igId,
      });
      // Update processed flag even if no account found to avoid double processing
      await supabase
        .from("webhook_logs")
        .update({ processed: true })
        .eq("dedupe_key", payload.dedupeKey);
      return { status: "no_account" as const };
    }
  } else if (!(accounts[0] as any).webhook_ig_id) {
    await supabase
      .from("instagram_accounts")
      .update({
        webhook_instagram_user_id: payload.igId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", (accounts[0] as any).id)
      .is("webhook_instagram_user_id", null);
  }

  const nowMs = Date.now();
  const expiredAccounts = (accounts ?? []).filter((account: any) => {
    const expiryMs = getTokenExpiryMs(account.token_expires_at);
    return expiryMs !== null && expiryMs - nowMs <= TOKEN_USABLE_BUFFER_MS;
  });

  for (const expiredAccount of expiredAccounts as InstagramAccountRecord[]) {
    await markAccountDisconnected(
      expiredAccount,
      "Instagram token expired. Please reconnect Instagram.",
      payload.requestId,
    );
  }

  let connectedAccounts = (accounts ?? []).filter(
    (a: any) => a.is_connected !== false && isAccountTokenUsable(a),
  );

  if (payload.mediaId) {
    const { data: mediaAutomations, error: mediaAutomationError } =
      await supabase
        .from("automations")
        .select("instagram_account_id,starts_at,ends_at")
        .eq("is_active", true)
        .eq("media_id", payload.mediaId);

    if (mediaAutomationError) {
      throw new Error(
        `Failed loading media automation account mapping: ${mediaAutomationError.message}`,
      );
    }

    await expireFinishedAutomations(
      (mediaAutomations ?? []) as any,
      payload.requestId,
    );

    const existingAccountIds = new Set(
      connectedAccounts.map((account: any) => account.id),
    );
    const mediaMappedAccountIds = Array.from(
      new Set(
        (mediaAutomations ?? [])
          .filter((automation: any) => isAutomationRunnableNow(automation))
          .map((automation: any) => automation.instagram_account_id)
          .filter(Boolean),
      ),
    );
    const missingAccountIds = mediaMappedAccountIds.filter(
      (accountId) => !existingAccountIds.has(accountId),
    );

    if (missingAccountIds.length > 0) {
      const { data: mappedAccounts, error: mappedAccountError } = await supabase
        .from("instagram_accounts")
        .select(instagramAccountSelectFields)
        .in("id", missingAccountIds)
        .eq("is_connected", true);

      if (mappedAccountError) {
        throw new Error(
          `Failed loading media mapped accounts: ${mappedAccountError.message}`,
        );
      }

      if ((mappedAccounts ?? []).length > 0) {
        connectedAccounts = [
          ...connectedAccounts,
          ...((mappedAccounts ?? []) as any[]),
        ];

        await supabase
          .from("instagram_accounts")
          .update({
            webhook_instagram_user_id: payload.igId,
            updated_at: new Date().toISOString(),
          })
          .in(
            "id",
            (mappedAccounts ?? []).map((account: any) => account.id),
          );

        logInfo("Expanded webhook account scope via media automation mapping", {
          requestId: payload.requestId,
          webhookIgId: payload.igId,
          mediaId: payload.mediaId,
          mappedAccountIds: (mappedAccounts ?? []).map(
            (account: any) => account.id,
          ),
        });
      }
    }
  }

  const expiredConnectedAccounts = connectedAccounts.filter(
    (account: any) => !isAccountTokenUsable(account),
  );
  for (const expiredAccount of expiredConnectedAccounts as InstagramAccountRecord[]) {
    await markAccountDisconnected(
      expiredAccount,
      "Instagram token expired. Please reconnect Instagram.",
      payload.requestId,
    );
  }
  connectedAccounts = connectedAccounts.filter((account: any) =>
    isAccountTokenUsable(account),
  );

  if (connectedAccounts.length === 0) {
    logInfo("No connected account row for incoming event", {
      requestId: payload.requestId,
      igId: payload.igId,
      accountCount: accounts.length,
    });
    await supabase
      .from("webhook_logs")
      .update({ processed: true, processing_error: "account_not_connected" })
      .eq("dedupe_key", payload.dedupeKey);
    return { status: "account_not_connected" as const };
  }

  let accountIds = connectedAccounts.map((a: any) => a.id);
  const ownerUserIds = Array.from(
    new Set(connectedAccounts.map((a: any) => a.user_id).filter(Boolean)),
  );
  let primaryAccount = connectedAccounts[0] as InstagramAccountRecord;

  let continuationSession: PendingAutomationSession | null = null;
  let continuationAutomation: AutomationRecord | null = null;
  if (payload.triggerType === "dm") {
    for (const account of connectedAccounts as InstagramAccountRecord[]) {
      const continuation = await getContinuationAutomation(
        account.id,
        payload.senderId,
        payload.messageText,
        payload.requestId,
      );

      if (continuation) {
        continuationSession = continuation.session;
        continuationAutomation = continuation.automation;

        if (!accountIds.includes(continuationSession.instagram_account_id)) {
          const { data: sessionAccount } = await supabase
            .from("instagram_accounts")
            .select(instagramAccountSelectFields)
            .eq("id", continuationSession.instagram_account_id)
            .maybeSingle();

          if (sessionAccount) {
            connectedAccounts = [sessionAccount as any, ...connectedAccounts];
            accountIds = [sessionAccount.id, ...accountIds];
            primaryAccount = sessionAccount as any;

            await supabase
              .from("instagram_accounts")
              .update({
                webhook_instagram_user_id: payload.igId,
                updated_at: new Date().toISOString(),
              })
              .eq("id", sessionAccount.id);
          }
        }
        break;
      }
    }
  }

  let { data: automations, error: automationError } = await supabase
    .from("automations")
    .select(automationSelectFields)
    .in("instagram_account_id", accountIds)
    .eq("is_active", true);

  if (automationError) {
    throw new Error(`Failed loading automations: ${automationError.message}`);
  }

  await expireFinishedAutomations(
    (automations ?? []) as any,
    payload.requestId,
  );

  const runnableAutomations = (automations ?? []).filter(
    (automation: any) =>
      !String(automation.name || "").includes(" - DM Follow-up") &&
      isAutomationRunnableNow(automation),
  );

  logInfo("Processing automation event", {
    requestId: payload.requestId,
    igId: payload.igId,
    triggerType: payload.triggerType,
    mediaId: payload.mediaId,
    totalRecordsFound: runnableAutomations.length,
    currentAccountIds: accountIds,
    ownerUserIds,
  });

  const triggerMatchedAutomations = continuationAutomation
    ? [continuationAutomation]
    : runnableAutomations.filter((a: any) => {
        // 1. Basic Trigger Type Match
        let typeMatch = a.trigger_type === payload.triggerType;
        if (!typeMatch) {
          if (
            payload.triggerType === "comment" &&
            a.trigger_type?.startsWith("comment_")
          )
            typeMatch = true;
          if (payload.triggerType === "dm" && a.trigger_type === "dm_received")
            typeMatch = true;
        }

        return typeMatch;
      });

  let filteredAutomations = continuationAutomation
    ? [continuationAutomation]
    : triggerMatchedAutomations.filter((a: any) => {
        const savedMediaId = a.media_id ? String(a.media_id) : "";
        const incomingMediaId = payload.mediaId ? String(payload.mediaId) : "";
        return !savedMediaId || savedMediaId === incomingMediaId;
      });

  logInfo("Filtered automations for matching", {
    requestId: payload.requestId,
    count: filteredAutomations.length,
    triggerMatchedCount: triggerMatchedAutomations.length,
    incomingMediaId: payload.mediaId,
    automationMediaIds: triggerMatchedAutomations.map((a: any) => ({
      id: a.id,
      triggerType: a.trigger_type,
      mediaId: a.media_id ?? null,
      keywordCount: Array.isArray(a.keywords) ? a.keywords.length : 0,
    })),
  });

  // Get ALL matching automations (not just first) so multiple keyword automations fire simultaneously
  const allMatched: AutomationRecord[] = continuationAutomation
    ? [continuationAutomation]
    : getAllMatchingAutomations(
        filteredAutomations as AutomationRecord[],
        payload.messageText,
      );

  // Primary matched automation (used for the main processing flow below)
  const matched = allMatched[0] ?? null;

  if (!matched) {
    logInfo("No automation match", {
      requestId: payload.requestId,
      text: payload.messageText,
    });
    await supabase
      .from("webhook_logs")
      .update({ processed: true })
      .eq("dedupe_key", payload.dedupeKey);
    return { status: "no_match" as const };
  }

  // Log if multiple automations matched (different keywords in one comment)
  if (allMatched.length > 1) {
    logInfo("Multiple automations matched for single event", {
      requestId: payload.requestId,
      matchCount: allMatched.length,
      automationIds: allMatched.map((a) => a.id),
    });
  }


  const canReply = await checkRateLimit(payload.igId, payload.senderId);
  if (!canReply) {
    logInfo("Reply skipped by rate limit", {
      requestId: payload.requestId,
      igId: payload.igId,
      senderId: payload.senderId,
      automationId: matched.id,
    });
    await supabase
      .from("webhook_logs")
      .update({ processed: true, processing_error: "rate_limited" })
      .eq("dedupe_key", payload.dedupeKey);
    return { status: "rate_limited" as const };
  }

  // Determine the account to use for sending
  let selectedAccount =
    (connectedAccounts.find(
      (account: any) => account.id === matched.instagram_account_id,
    ) as InstagramAccountRecord | undefined) ?? primaryAccount;

  // Get user_id for the selected account if needed
  let ownerUserId = (selectedAccount as any).user_id;
  if (!ownerUserId) {
    logInfo("user_id not in selectedAccount, fetching separately", {
      requestId: payload.requestId,
      accountId: selectedAccount.id,
    });
    const { data: accountRow, error: ownerFetchError } = await supabase
      .from("instagram_accounts")
      .select("user_id")
      .eq("id", selectedAccount.id)
      .single();
    if (ownerFetchError) {
      logError("Failed to fetch ownerUserId", {
        requestId: payload.requestId,
        accountId: selectedAccount.id,
        error: ownerFetchError.message,
      });
    }
    ownerUserId = accountRow?.user_id;
  }

  logInfo("ownerUserId resolved", {
    requestId: payload.requestId,
    ownerUserId,
    accountId: selectedAccount.id,
    igId: selectedAccount.ig_id,
  });

  const automationOwnerUserId = (matched as any).user_id || ownerUserId;

  let tokenBundle = await refreshAccountTokenIfNeeded(
    selectedAccount,
    payload.requestId,
  );
  let senderProfile = await enrichSenderProfileFromContact(
    selectedAccount.id,
    payload.senderId,
    getSenderProfile(payload),
  );
  senderProfile = mergeSenderProfile(
    senderProfile,
    await fetchInstagramScopedUserProfile(
      payload.senderId,
      tokenBundle.pageAccessToken,
      payload.requestId,
    ),
  );

  if (
    matched.require_follow === true &&
    payload.triggerType === "comment" &&
    senderProfile.isFollowingYou !== true
  ) {
    const fallbackText =
      (matched.fallback_comment_reply || "").trim() ||
      "Please follow us to receive the automated message!";
    logInfo("Follow gate triggered", {
      requestId: payload.requestId,
      automationId: matched.id,
      senderId: payload.senderId,
    });

    if (payload.eventId) {
      await sendInstagramCommentReply(
        payload.eventId,
        fallbackText,
        tokenBundle.pageAccessToken,
        payload.requestId,
      );
    }

    await supabase
      .from("webhook_logs")
      .update({ processed: true, processing_error: "follow_gate_blocked" })
      .eq("dedupe_key", payload.dedupeKey);
    return { status: "follow_gate_blocked" as const };
  }

  let responseActions = continuationSession
    ? buildResponseActions(
        matched,
        senderProfile,
        continuationSession.next_node_index,
        false,
      )
    : payload.triggerType === "comment"
      ? getCommentPrivateReplyActions(
          buildResponseActions(matched, senderProfile),
        )
      : buildResponseActions(matched, senderProfile);
  const deliveryPlan = automationOwnerUserId
    ? await resolveDeliveryPlan(automationOwnerUserId)
    : { id: "free", replyLimit: 50 };
  const isWaitingForUserReply = (actions: MessageAction[]): boolean => {
    for (const action of actions) {
      if (action.type === "template") {
        for (const element of (action as any).elements ?? []) {
          if ((element.buttons ?? []).some((b: any) => b.type === "postback")) {
            return true;
          }
        }
      } else if (action.type === "text" && (action as any).quickReplies?.length > 0) {
        return true;
      }
    }
    return false;
  };

  responseActions = applyDeliveryBranding(
    responseActions,
    deliveryPlan.id === "free" && !isWaitingForUserReply(responseActions),
  );
  const primaryReplyText = getFirstMessageText(responseActions);
  if (responseActions.length === 0) {
    logInfo(
      "No sendable response found in automation response_flow, skipping",
      {
        requestId: payload.requestId,
        automationId: matched.id,
      },
    );
    await supabase
      .from("webhook_logs")
      .update({ processed: true, processing_error: "no_reply_text" })
      .eq("dedupe_key", payload.dedupeKey);
    return { status: "no_reply_text" as const };
  }

  if (!automationOwnerUserId) {
    throw new Error(
      "Cannot enforce Auto-DM entitlements without an automation owner",
    );
  }

  if (deliveryPlan.id === "free") {
    const { data: knownContact, error: knownContactError } = await supabase
      .from("contacts")
      .select("id")
      .eq("user_id", automationOwnerUserId)
      .eq("instagram_account_id", selectedAccount.id)
      .eq("instagram_user_id", payload.senderId)
      .maybeSingle();
    if (knownContactError) {
      throw new Error(
        `Unable to verify contact entitlement: ${knownContactError.message}`,
      );
    }
    if (!knownContact) {
      const { count, error: contactCountError } = await supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", automationOwnerUserId);
      if (contactCountError) {
        throw new Error(
          `Unable to verify contact limit: ${contactCountError.message}`,
        );
      }
      if ((count ?? 0) >= 100) {
        await supabase
          .from("webhook_logs")
          .update({
            processed: true,
            processing_error: "contact_limit_reached",
          })
          .eq("dedupe_key", payload.dedupeKey);
        return { status: "plan_limit_reached" as const };
      }
    }
  }

  const replyAllowed = await reserveMonthlyAutoDmReply(
    automationOwnerUserId,
    deliveryPlan.replyLimit,
  );
  if (!replyAllowed) {
    await supabase
      .from("webhook_logs")
      .update({
        processed: true,
        processing_error: "autodm_reply_limit_reached",
      })
      .eq("dedupe_key", payload.dedupeKey);
    return { status: "plan_limit_reached" as const };
  }

  // ── STEP 1: Contact save PEHLE karo (DM send se independent) ─────────────
  // CRITICAL FIX: Contact save send ke BAAD tha. Agar send fail ho toh contact
  // kabhi nahi banta tha. Ab pehle save karo, chahe send fail ho ya na ho.
  let contactId: string | null = null;

  if (automationOwnerUserId) {
    try {
      const username = senderProfile.username || `user_${payload.senderId}`;
      const contactProfileFields = {
        full_name:
          senderProfile.fullName && senderProfile.fullName !== "there"
            ? senderProfile.fullName
            : undefined,
        profile_picture_url: senderProfile.profilePictureUrl || undefined,
        follower_count:
          typeof senderProfile.followerCount === "number"
            ? senderProfile.followerCount
            : undefined,
        is_following_you:
          typeof senderProfile.isFollowingYou === "boolean"
            ? senderProfile.isFollowingYou
            : undefined,
        you_are_following:
          typeof senderProfile.youAreFollowing === "boolean"
            ? senderProfile.youAreFollowing
            : undefined,
      };

      logInfo("Saving contact (pre-send)", {
        requestId: payload.requestId,
        senderId: payload.senderId,
        username,
        accountId: selectedAccount.id,
        ownerUserId: automationOwnerUserId,
        triggerType: payload.triggerType,
      });

      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id, username, total_messages_sent, total_messages_received")
        .eq("instagram_account_id", selectedAccount.id)
        .eq("instagram_user_id", payload.senderId)
        .maybeSingle();

      if (!existingContact) {
        const { data: newContact, error: insertError } = await supabase
          .from("contacts")
          .insert({
            user_id: automationOwnerUserId,
            instagram_account_id: selectedAccount.id,
            instagram_user_id: payload.senderId,
            username,
            ...contactProfileFields,
            first_interaction_at: new Date().toISOString(),
            last_interaction_at: new Date().toISOString(),
            total_messages_sent: 0,
            total_messages_received: 1,
          })
          .select("id")
          .single();

        if (insertError) {
          logError("Contact insert failed", {
            requestId: payload.requestId,
            error: insertError.message,
            code: insertError.code,
            senderId: payload.senderId,
            accountId: selectedAccount.id,
            ownerUserId: automationOwnerUserId,
          });
        } else {
          contactId = newContact.id;
          syncSocialContactToEcosystemSoon({
            supabase,
            contactId,
            userId: automationOwnerUserId,
            instagramAccountId: selectedAccount.id,
            instagramUserId: payload.senderId,
            username,
            fullName: contactProfileFields.full_name,
            profilePictureUrl: contactProfileFields.profile_picture_url,
            requestId: payload.requestId,
          });
          logInfo("New contact created", {
            requestId: payload.requestId,
            contactId,
            username,
          });
        }
      } else {
        contactId = existingContact.id;
        const updatedUsername =
          username !== `user_${payload.senderId}`
            ? username
            : existingContact.username;

        const { error: updateError } = await supabase
          .from("contacts")
          .update({
            username: updatedUsername,
            ...contactProfileFields,
            last_interaction_at: new Date().toISOString(),
            total_messages_received:
              (existingContact.total_messages_received ?? 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", contactId);

        if (updateError) {
          logError("Contact update failed", {
            requestId: payload.requestId,
            error: updateError.message,
            code: updateError.code,
          });
        } else {
          syncSocialContactToEcosystemSoon({
            supabase,
            contactId,
            userId: automationOwnerUserId,
            instagramAccountId: selectedAccount.id,
            instagramUserId: payload.senderId,
            username: updatedUsername,
            fullName: contactProfileFields.full_name,
            profilePictureUrl: contactProfileFields.profile_picture_url,
            requestId: payload.requestId,
          });
          logInfo("Existing contact updated", {
            requestId: payload.requestId,
            contactId,
          });
        }
      }
    } catch (contactError) {
      logError("Failed to save contact (pre-send)", {
        requestId: payload.requestId,
        igId: payload.igId,
        senderId: payload.senderId,
        accountId: selectedAccount.id,
        ownerUserId: automationOwnerUserId,
        error:
          contactError instanceof Error
            ? contactError.message
            : String(contactError),
        stack: contactError instanceof Error ? contactError.stack : undefined,
      });
    }
  } else {
    logError("ownerUserId is null — contact save skipped", {
      requestId: payload.requestId,
      igId: payload.igId,
      accountId: selectedAccount.id,
    });
  }
  // ─────────────────────────────────────────────────────────────────────

  // ── STEP 2: Get tokens and send reply ────────────────────────────────
  logInfo("Token bundle loaded for reply", {
    requestId: payload.requestId,
    accountId: selectedAccount.id,
    tokenExpiresAt: selectedAccount.token_expires_at,
    pageTokenLength: tokenBundle.pageAccessToken.length,
    userTokenLength: tokenBundle.userAccessToken.length,
    pageTokenLooksEncrypted: tokenBundle.pageAccessToken.startsWith("enc:"),
    pageTokenHasWhitespace: /\s/.test(tokenBundle.pageAccessToken),
    pageTokenDotCount: (tokenBundle.pageAccessToken.match(/\./g) ?? []).length,
  });

  const sendAction = async (
    action: MessageAction,
    tokens: { pageAccessToken: string },
    usePrivateReply: boolean,
  ) => {
    if (action.type === "delay") {
      await sleep(action.seconds);
      return { ok: true as const, result: { delayed: action.seconds } };
    }

    if (action.type === "image") {
      if (usePrivateReply && payload.eventId) {
        return await sendInstagramPrivateReplyImage(
          webhookIgIdForSend,
          payload.eventId,
          action.imageUrl,
          tokens.pageAccessToken,
          payload.requestId,
        );
      }

      return await sendInstagramImage(
        webhookIgIdForSend,
        payload.senderId,
        action.imageUrl,
        tokens.pageAccessToken,
        payload.requestId,
      );
    }

    if (action.type === "template") {
      if (usePrivateReply && payload.eventId) {
        return await sendInstagramPrivateReplyGenericTemplate(
          webhookIgIdForSend,
          payload.eventId,
          action.elements,
          tokens.pageAccessToken,
          payload.requestId,
        );
      }

      return await sendInstagramGenericTemplate(
        webhookIgIdForSend,
        payload.senderId,
        action.elements,
        tokens.pageAccessToken,
        payload.requestId,
      );
    }

    if (usePrivateReply && payload.eventId) {
      const result = await sendInstagramPrivateReplyPayload(
        webhookIgIdForSend,
        payload.eventId,
        action.text,
        tokens.pageAccessToken,
        payload.requestId,
        action.quickReplies,
        action.quickReplies?.length ? 1 : 3,
      );

      if (!result.ok && action.quickReplies?.length) {
        logError(
          "Private reply with quick replies failed; retrying as plain text",
          {
            requestId: payload.requestId,
            automationId: matched.id,
            error: result.error,
          },
        );

        return await sendInstagramPrivateReplyPayload(
          webhookIgIdForSend,
          payload.eventId,
          action.text,
          tokens.pageAccessToken,
          payload.requestId,
        );
      }

      return result;
    }

    const result = await sendInstagramTextPayload(
      webhookIgIdForSend,
      payload.senderId,
      action.text,
      tokens.pageAccessToken,
      payload.requestId,
      action.quickReplies,
      action.quickReplies?.length ? 1 : 3,
    );

    if (!result.ok && action.quickReplies?.length) {
      logError("Message with quick replies failed; retrying as plain text", {
        requestId: payload.requestId,
        automationId: matched.id,
        error: result.error,
      });

      return await sendInstagramTextPayload(
        webhookIgIdForSend,
        payload.senderId,
        action.text,
        tokens.pageAccessToken,
        payload.requestId,
      );
    }

    return result;
  };

  const performReply = async (tokens: { pageAccessToken: string }) => {
    let sentCount = 0;
    let failedCount = 0;
    let firstError = "";

    for (const [index, action] of responseActions.entries()) {
      const usePrivateReply =
        payload.triggerType === "comment" &&
        index === 0 &&
        Boolean(payload.eventId);
      const result = await sendAction(action, tokens, usePrivateReply);

      if (!result.ok) {
        if (sentCount === 0 && isTokenExpiredError(result.error)) {
          return { ...result, sentCount };
        }

        if (action.type === "template") {
          const fallbackText = templateToFallbackText(action);
          if (fallbackText) {
            const fallbackResult = await sendAction(
              { type: "text", text: fallbackText },
              tokens,
              usePrivateReply,
            );
            if (fallbackResult.ok) {
              sentCount += 1;
              continue;
            }
          }
        }

        failedCount += 1;
        firstError ||= result.error;
        const actionFailurePayload = {
          requestId: payload.requestId,
          automationId: matched.id,
          actionType: action.type,
          actionIndex: index,
          error: result.error,
        };

        if (isInstagramOutsideAllowedWindowError(result.error)) {
          logInfo(
            "Response flow action skipped outside messaging window",
            actionFailurePayload,
          );
          break;
        } else {
          logError(
            "Response flow action failed; continuing sequence",
            actionFailurePayload,
          );
        }
        continue;
      }

      if (action.type !== "delay") {
        sentCount += 1;
      }
    }

    if (sentCount === 0 && failedCount > 0) {
      return {
        ok: false as const,
        error: firstError || "All response actions failed",
        sentCount,
      };
    }

    return { ok: true as const, result: { sentCount, failedCount } };
  };

  let sendResult = await performReply(tokenBundle);

  if (
    !sendResult.ok &&
    isTokenExpiredError(sendResult.error) &&
    sendResult.sentCount === 0
  ) {
    try {
      tokenBundle = await refreshAccountTokenIfNeeded(
        {
          ...primaryAccount,
          token_expires_at: new Date(0).toISOString(),
        },
        payload.requestId,
      );
      sendResult = await performReply(tokenBundle);
    } catch (error) {
      logError("Token refresh retry failed", {
        requestId: payload.requestId,
        igId: payload.igId,
        senderId: payload.senderId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  let commentReplyAttempted = false;
  if (
    !commentReplyAttempted &&
    payload.triggerType === "comment" &&
    payload.eventId &&
    matched.comment_reply_enabled &&
    matched.comment_reply_text?.trim()
  ) {
    commentReplyAttempted = true;
    const commentReplyText = renderMessageTemplate(
      stripBrandingWatermark(matched.comment_reply_text.trim()),
      senderProfile,
    ).trim();
    const commentReplyResult = await sendInstagramCommentReply(
      payload.eventId,
      commentReplyText,
      tokenBundle.pageAccessToken,
      payload.requestId,
    );

    if (!commentReplyResult.ok) {
      logError("Comment reply failed", {
        requestId: payload.requestId,
        automationId: matched.id,
        commentId: payload.eventId,
        error: commentReplyResult.error,
      });
    }
  }

  const currentStartNodeIndex = continuationSession
    ? continuationSession.next_node_index
    : 0;
  const currentIncludeOpening = !continuationSession && payload.triggerType === "comment";
  const nextSession = contactId
    ? computeNextSessionState(matched, currentStartNodeIndex, currentIncludeOpening)
    : null;

  if (nextSession) {
    const sessionPayload = {
      automation_id: matched.id,
      instagram_account_id: selectedAccount.id,
      contact_id: contactId,
      sender_id: payload.senderId,
      expected_keywords: nextSession.expectedKeywords,
      next_node_index: nextSession.nextNodeIndex,
      status: "pending",
      expires_at: new Date(
        Date.now() + 1000 * 60 * 60 * 24 * 7,
      ).toISOString(),
    };

    if (continuationSession?.id) {
      const { error: updateSessionErr } = await supabase
        .from("automation_sessions")
        .update(sessionPayload)
        .eq("id", continuationSession.id);

      if (updateSessionErr) {
        logError("Failed advancing continuation automation session", {
          requestId: payload.requestId,
          sessionId: continuationSession.id,
          error: updateSessionErr.message,
        });
      }
    } else {
      const { data: existingSession, error: existingSessionError } =
        await supabase
          .from("automation_sessions")
          .select("id")
          .eq("automation_id", matched.id)
          .eq("instagram_account_id", selectedAccount.id)
          .eq("sender_id", payload.senderId)
          .eq("status", "pending")
          .maybeSingle();

      if (existingSessionError) {
        logError("Failed checking existing automation session", {
          requestId: payload.requestId,
          automationId: matched.id,
          contactId,
          senderId: payload.senderId,
          error: existingSessionError.message,
        });
      } else if (existingSession?.id) {
        const { error: sessionUpdateError } = await supabase
          .from("automation_sessions")
          .update(sessionPayload)
          .eq("id", existingSession.id);

        if (sessionUpdateError) {
          logError("Failed updating automation session", {
            requestId: payload.requestId,
            automationId: matched.id,
            contactId,
            senderId: payload.senderId,
            error: sessionUpdateError.message,
          });
        }
      } else {
        const { error: sessionInsertError } = await supabase
          .from("automation_sessions")
          .insert(sessionPayload);

        if (sessionInsertError) {
          logError("Failed inserting automation session", {
            requestId: payload.requestId,
            automationId: matched.id,
            contactId,
            senderId: payload.senderId,
            error: sessionInsertError.message,
          });
        }
      }
    }
  } else if (continuationSession?.id) {
    const { error: sessionCompleteError } = await supabase
      .from("automation_sessions")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", continuationSession.id);

    if (sessionCompleteError) {
      logError("Failed completing automation session", {
        requestId: payload.requestId,
        sessionId: continuationSession.id,
        error: sessionCompleteError.message,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────

  // ── STEP 3: Record messages (only after successful send) ──────────────
  if (automationOwnerUserId && contactId) {
    try {
      // Record Inbound Message (The trigger)
      const { error: inboundMsgError } = await supabase
        .from("messages")
        .insert({
          user_id: automationOwnerUserId,
          instagram_account_id: selectedAccount.id,
          contact_id: contactId,
          automation_id: matched.id,
          direction: "inbound",
          message_type: "text",
          content: payload.messageText,
          instagram_message_id: payload.eventId,
          created_at: new Date().toISOString(),
        });
      if (inboundMsgError) {
        logError("Failed to insert inbound message", {
          requestId: payload.requestId,
          error: inboundMsgError.message,
          code: inboundMsgError.code,
        });
      }

      // Record Outbound Message (The reply) + update sent count
      const outboundLog = serializeMessageActionForLog(
        getLoggableOutboundAction(responseActions),
      );
      const { error: outboundMsgError } = await supabase
        .from("messages")
        .insert({
          user_id: automationOwnerUserId,
          instagram_account_id: selectedAccount.id,
          contact_id: contactId,
          automation_id: matched.id,
          direction: "outbound",
          message_type: outboundLog.messageType,
          content: outboundLog.content,
          media_url: outboundLog.mediaUrl,
          status: "sent",
          sent_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
      if (outboundMsgError) {
        logError("Failed to insert outbound message", {
          requestId: payload.requestId,
          error: outboundMsgError.message,
          code: outboundMsgError.code,
        });
      }

      // Update total_messages_sent count on contact (reply bheja toh sent count badhao)
      await supabase
        .from("contacts")
        .update({
          total_messages_sent: 1, // Placeholder — contacts table ne pehle se count track kiya hua hai
          updated_at: new Date().toISOString(),
        })
        .eq("id", contactId)
        .select("total_messages_sent") // Trigger for RPC update if needed
        .single();
    } catch (msgError) {
      logError("Failed to record messages", {
        requestId: payload.requestId,
        contactId,
        error: msgError instanceof Error ? msgError.message : String(msgError),
      });
    }
  }
  // ─────────────────────────────────────────────────────────────────────

  const { error: replyLogError } = await supabase.from("reply_logs").insert({
    ig_id: selectedAccount.ig_id,
    sender_id: payload.senderId,
    automation_id: matched.id,
  });

  if (replyLogError) {
    logError("Failed writing reply log", {
      requestId: payload.requestId,
      error: replyLogError.message,
    });
  }

  const { error: webhookUpdateError } = await supabase
    .from("webhook_logs")
    .update({ processed: true })
    .eq("dedupe_key", payload.dedupeKey);

  if (webhookUpdateError) {
    logError("Failed setting webhook processed flag", {
      requestId: payload.requestId,
      dedupeKey: payload.dedupeKey,
      error: webhookUpdateError.message,
    });
  }

  // ── Fire remaining matched automations (different keywords, same comment) ─
  // Runs when a comment contains keywords matching multiple different automations.
  // Example: comment "info price" triggers both an 'info' automation AND a 'price' automation.
  const secondaryMatches = allMatched.slice(1);
  for (const secondaryAutomation of secondaryMatches) {
    try {
      const secondaryAccount =
        (connectedAccounts.find(
          (a: any) => a.id === secondaryAutomation.instagram_account_id,
        ) as InstagramAccountRecord | undefined) ?? primaryAccount;

      const secondaryTokenBundle = await refreshAccountTokenIfNeeded(
        secondaryAccount,
        payload.requestId,
      );

      const secondaryActions =
        payload.triggerType === "comment"
          ? getCommentPrivateReplyActions(
              buildResponseActions(secondaryAutomation, senderProfile),
            )
          : buildResponseActions(secondaryAutomation, senderProfile);

      const secondaryBrandedActions = applyDeliveryBranding(
        secondaryActions,
        deliveryPlan.id === "free" && !isWaitingForUserReply(secondaryActions),
      );

      if (secondaryBrandedActions.length > 0) {
        for (const [idx, action] of secondaryBrandedActions.entries()) {
          if (action.type === "delay") { await sleep((action as any).seconds); continue; }
          const usePrivate = payload.triggerType === "comment" && idx === 0 && Boolean(payload.eventId);
          await sendAction(action, secondaryTokenBundle, usePrivate);
        }

        // Public comment reply for secondary automation (if enabled)
        if (
          payload.triggerType === "comment" &&
          payload.eventId &&
          secondaryAutomation.comment_reply_enabled &&
          secondaryAutomation.comment_reply_text?.trim()
        ) {
          const secReplyText = renderMessageTemplate(
            stripBrandingWatermark(secondaryAutomation.comment_reply_text.trim()),
            senderProfile,
          ).trim();
          await sendInstagramCommentReply(
            payload.eventId,
            secReplyText,
            secondaryTokenBundle.pageAccessToken,
            payload.requestId,
          ).catch((e: unknown) => {
            logError("Secondary automation comment reply failed", {
              requestId: payload.requestId,
              automationId: secondaryAutomation.id,
              error: e instanceof Error ? e.message : String(e),
            });
          });
        }

        // reply_log entry for secondary automation
        const { error: secLogError } = await supabase.from("reply_logs").insert({
          ig_id: secondaryAccount.ig_id,
          sender_id: payload.senderId,
          automation_id: secondaryAutomation.id,
        });
        if (secLogError) {
          logError("Failed writing secondary reply log", {
            requestId: payload.requestId,
            automationId: secondaryAutomation.id,
            error: secLogError.message,
          });
        }

        logInfo("Secondary automation fired successfully", {
          requestId: payload.requestId,
          automationId: secondaryAutomation.id,
        });
      }
    } catch (secondaryError) {
      // Log but continue — one secondary automation failing should not block others
      logError("Secondary automation processing failed", {
        requestId: payload.requestId,
        automationId: secondaryAutomation.id,
        error: secondaryError instanceof Error ? secondaryError.message : String(secondaryError),
      });
    }
  }
  // ─────────────────────────────────────────────────────────────────────

  return {
    status: "sent" as const,
    automationId: matched.id,
    contactId,
  };
};

