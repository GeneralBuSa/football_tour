'use client';
// Ana menü sosyal paneli: arkadaş listesi, istekler, canlı mesajlaşma ve oyun davetleri.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import apiService from '../../../services/ApiService.js';
import { trackEvent } from '../../../services/analytics.js';
import socialStream, {
  conversationPartnerId, groupFriends, mergeMessages, validateMessageBody
} from '../../../services/SocialService.js';

const FRIEND_REFRESH_MS = 30000;

export default function useSocial({ isLoggedIn, user }) {
  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState('');
  const [unread, setUnread] = useState({});
  const [conversations, setConversations] = useState({});
  const [conversationLoading, setConversationLoading] = useState(false);
  const [activeFriendId, setActiveFriendId] = useState(null);
  const [invites, setInvites] = useState([]);
  const activeFriendRef = useRef(null);
  const userId = user?.id;

  useEffect(() => { activeFriendRef.current = activeFriendId; }, [activeFriendId]);

  const loadFriends = useCallback(async () => {
    if (!isLoggedIn) return;
    setFriendsLoading(true);
    const res = await apiService.getFriends();
    if (Array.isArray(res)) {
      setFriends(res);
      setFriendsError('');
    } else {
      setFriendsError(res?.error || 'Arkadaş listesi yüklenemedi.');
    }
    setFriendsLoading(false);
  }, [isLoggedIn]);

  const loadUnread = useCallback(async () => {
    if (!isLoggedIn) return;
    const res = await apiService.getUnreadCounts();
    if (res && res.counts) setUnread(res.counts);
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !userId) return undefined;
    loadFriends();
    loadUnread();

    const unsubscribe = socialStream.subscribe(payload => {
      if (payload.type === 'friends_changed') {
        loadFriends();
        return;
      }
      if (payload.type !== 'message' || !payload.message) return;
      const message = payload.message;
      const partnerId = conversationPartnerId(message, userId);
      setConversations(prev => ({ ...prev, [partnerId]: mergeMessages(prev[partnerId] || [], message) }));

      if (message.sender_id !== userId) {
        if (activeFriendRef.current !== partnerId) {
          setUnread(prev => ({ ...prev, [partnerId]: (prev[partnerId] || 0) + 1 }));
        }
        if (message.kind === 'game_invite') {
          setInvites(prev => prev.some(i => i.id === message.id) ? prev : [...prev, message]);
        }
      }
    });

    const refresh = () => loadFriends();
    window.addEventListener('ft26:refresh-friends', refresh);
    const timer = setInterval(loadFriends, FRIEND_REFRESH_MS);
    return () => {
      unsubscribe();
      window.removeEventListener('ft26:refresh-friends', refresh);
      clearInterval(timer);
    };
  }, [isLoggedIn, userId, loadFriends, loadUnread]);

  const grouped = useMemo(() => groupFriends(friends), [friends]);

  const runFriendAction = useCallback(async (action) => {
    const res = await action();
    if (res?.error) return { ok: false, error: res.error };
    await loadFriends();
    return { ok: true, data: res };
  }, [loadFriends]);

  const addFriend = useCallback(async (username) => {
    const trimmed = (username || '').trim();
    if (!/^[A-Za-z0-9_]{3,24}$/.test(trimmed)) {
      return { ok: false, error: 'Kullanıcı adı 3-24 karakter olmalı; harf, rakam ve _ içerebilir.' };
    }
    if (trimmed === user?.username) return { ok: false, error: 'Kendinizi arkadaş ekleyemezsiniz.' };
    const result = await runFriendAction(() => apiService.addFriend(trimmed));
    if (result.ok) trackEvent('friend_request_sent');
    return result;
  }, [runFriendAction, user?.username]);

  const acceptFriend = useCallback(id => runFriendAction(() => apiService.acceptFriendRequest(id)), [runFriendAction]);
  const rejectFriend = useCallback(id => runFriendAction(() => apiService.rejectFriendRequest(id)), [runFriendAction]);
  const removeFriend = useCallback(async id => {
    const result = await runFriendAction(() => apiService.removeFriend(id));
    if (result.ok && activeFriendRef.current === id) setActiveFriendId(null);
    return result;
  }, [runFriendAction]);

  const openConversation = useCallback(async (friendId) => {
    setActiveFriendId(friendId);
    if (!friendId) return { ok: true };
    setUnread(prev => {
      if (!prev[friendId]) return prev;
      const next = { ...prev };
      delete next[friendId];
      return next;
    });
    setConversationLoading(true);
    const res = await apiService.getConversation(friendId);
    setConversationLoading(false);
    if (!Array.isArray(res)) return { ok: false, error: res?.error || 'Mesajlar yüklenemedi.' };
    setConversations(prev => ({ ...prev, [friendId]: mergeMessages(prev[friendId] || [], res) }));
    return { ok: true };
  }, []);

  const sendMessage = useCallback(async (friendId, text) => {
    const validation = validateMessageBody(text);
    if (!validation.ok) return validation;
    const res = await apiService.sendMessage(friendId, validation.value);
    if (res?.error) return { ok: false, error: res.error };
    setConversations(prev => ({ ...prev, [friendId]: mergeMessages(prev[friendId] || [], res) }));
    return { ok: true };
  }, []);

  // Özel oda kurar ve arkadaşa davet mesajı gönderir.
  const inviteFriend = useCallback(async (friend) => {
    if (typeof window.createPrivateRoomAction !== 'function') {
      return { ok: false, error: 'Oyun henüz yükleniyor, lütfen tekrar deneyin.' };
    }
    const created = await window.createPrivateRoomAction();
    if (!created) return { ok: false, error: 'Özel oda kurulamadı.' };
    const res = await apiService.sendGameInvite(friend.friend_id);
    if (res?.error) return { ok: false, error: res.error };
    setConversations(prev => ({ ...prev, [friend.friend_id]: mergeMessages(prev[friend.friend_id] || [], res) }));
    return { ok: true };
  }, []);

  const dismissInvite = useCallback(id => setInvites(prev => prev.filter(invite => invite.id !== id)), []);

  return {
    friends,
    grouped,
    friendsLoading,
    friendsError,
    unread,
    conversations,
    conversationLoading,
    activeFriendId,
    invites,
    loadFriends,
    addFriend,
    acceptFriend,
    rejectFriend,
    removeFriend,
    openConversation,
    sendMessage,
    inviteFriend,
    dismissInvite
  };
}
