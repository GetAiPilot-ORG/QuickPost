import React, { useEffect, useState } from 'react';
import { useAutoDM } from '../../context/AutoDMContext';
import { Download, ExternalLink, MessageCircle, Search, X } from 'lucide-react';
import AutoDMAccountSwitcher from './AutoDMAccountSwitcher';
import InfoHelp from '../../components/InfoHelp';

function formatRelativeTime(isoString) {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function ContactAvatar({ contact, size = 36 }) {
  return (
    <div className="autodm-avatar" style={{ width: size, height: size }}>
      {contact.profile_picture_url ? (
        <img src={contact.profile_picture_url} alt="" />
      ) : (
        <span>{contact.username?.[0]?.toUpperCase() || 'I'}</span>
      )}
    </div>
  );
}

function parseTemplateMessage(message) {
  if (message.message_type !== 'template') return null;
  try {
    const parsed = JSON.parse(message.content || '{}');
    return Array.isArray(parsed.elements) ? parsed.elements : null;
  } catch {
    return null;
  }
}

function MessageBubbleContent({ message }) {
  const templateElements = parseTemplateMessage(message);

  if (templateElements?.length) {
    return (
      <div className="autodm-template-stack">
        {templateElements.map((element, index) => (
          <article className="autodm-template-card" key={`${message.id}-template-${index}`}>
            {element.image_url ? <img src={element.image_url} alt="" /> : null}
            <div className="autodm-template-body">
              {element.title ? <strong>{element.title}</strong> : null}
              {element.subtitle ? <p>{element.subtitle}</p> : null}
              {element.buttons?.length ? (
                <div className="autodm-template-actions">
                  {element.buttons.map((button, buttonIndex) => (
                    <span key={`${message.id}-button-${buttonIndex}`}>
                      {button.title || button.url || button.payload}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (message.message_type === 'image' && (message.media_url || message.content)) {
    return <img className="autodm-message-image" src={message.media_url || message.content} alt="" />;
  }

  return <p>{message.content || ''}</p>;
}

function MessageHistoryDialog({ contact, messages, loading, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content autodm-message-dialog" onClick={(event) => event.stopPropagation()}>
        <header className="autodm-dialog-header">
          <ContactAvatar contact={contact} size={42} />
          <div>
            <h2>@{contact.username}</h2>
            <p>Message history</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close message history">
            <X size={18} />
          </button>
        </header>

        <div className="autodm-message-list custom-scrollbar">
          {loading ? (
            <div className="autodm-empty">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="autodm-empty">
              <img src="https://illustrations.popsy.co/amber/graphic-design.svg" className="h-32 object-contain mx-auto mb-4" alt="No Message History" />
              <p>No message history yet</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`autodm-bubble-row ${message.direction === 'outbound' ? 'is-outbound' : ''}`}
              >
                <div className="autodm-bubble">
                  <MessageBubbleContent message={message} />
                  <time>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                </div>
              </div>
            ))
          )}
        </div>

        <footer className="autodm-dialog-footer">
          Automated message log. Reply from Instagram or Meta inbox.
        </footer>
      </div>
    </div>
  );
}

export default function AutoDMContactsPage() {
  const { contacts, contactsLoading, loadContacts, activeAccount, fetchMessagesForContact } = useAutoDM();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const perPage = 10;

  useEffect(() => {
    if (activeAccount?.id) loadContacts();
  }, [activeAccount?.id]);

  const filtered = contacts.filter((contact) => {
    const query = search.toLowerCase();
    return (
      contact.username.toLowerCase().includes(query) ||
      (contact.full_name?.toLowerCase() || '').includes(query)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const openMessages = async (contact) => {
    setSelectedContact(contact);
    setMessages([]);
    setMessagesLoading(true);
    try {
      setMessages(await fetchMessagesForContact(contact.id));
    } finally {
      setMessagesLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Username', 'Name', 'Follows You', 'You Follow', 'Msg Sent', 'First Interaction', 'Last Interaction'];
    const rows = contacts.map((contact) => [
      contact.username,
      contact.full_name || '',
      contact.is_following_you ? 'Yes' : 'No',
      contact.you_are_following ? 'Yes' : 'No',
      contact.total_messages_sent,
      contact.first_interaction_at,
      contact.last_interaction_at,
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'autodm-contacts.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="autodm-page">
      <header className="autodm-page-header">
        <div>
          <p className="eyebrow">GAP AutoDM</p>
          <h1 style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            Contacts
            <InfoHelp text="Unified directory of Instagram users who have interacted with your automated DM triggers and campaigns" />
          </h1>
          <p>
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''} from Instagram automation conversations.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <AutoDMAccountSwitcher />
          <button type="button" className="btn-secondary flex items-center justify-center gap-2 px-4" onClick={exportCSV} disabled={contacts.length === 0}>
            <Download size={15} />
            Export
          </button>
        </div>
      </header>

      <div className="autodm-toolbar">
        <Search size={15} />
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search contacts"
        />
      </div>

      <section className="card-shadow autodm-table-card">
        <div className="autodm-contact-head">
          <span>Contact</span>
          <span>Messages</span>
          <span>Relationship</span>
          <span>Last seen</span>
          <span>Action</span>
        </div>

        {contactsLoading ? (
          <div className="autodm-loading-list">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="skeleton-shimmer" />
            ))}
          </div>
        ) : paginated.length === 0 ? (
          <div className="autodm-empty">
            <img src="https://illustrations.popsy.co/amber/product-launch.svg" className="h-40 object-contain mx-auto mb-4" alt="No Contacts" />
            <p>No contacts found</p>
            <span>Contacts appear after someone interacts with an automation.</span>
          </div>
        ) : (
          paginated.map((contact) => (
            <article key={contact.id} className="autodm-contact-row">
              <div className="autodm-contact-main">
                <ContactAvatar contact={contact} />
                <div>
                  <strong>{contact.full_name || contact.username}</strong>
                  <a href={`https://instagram.com/${contact.username}`} target="_blank" rel="noopener noreferrer">
                    @{contact.username}
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>

              <div className="autodm-counts">
                <span>{contact.total_messages_sent || 0} sent</span>
                <span>{contact.total_messages_received || 0} received</span>
              </div>

              <div className="autodm-chip-stack">
                {contact.you_are_following ? <span className="badge badge-slate">You follow</span> : null}
                {contact.is_following_you ? <span className="badge badge-success">Follows you</span> : null}
                {!contact.you_are_following && !contact.is_following_you ? <span className="autodm-muted">None</span> : null}
              </div>

              <time className="autodm-muted">{formatRelativeTime(contact.last_interaction_at)}</time>

              <button type="button" className="btn-ghost" onClick={() => openMessages(contact)}>
                <MessageCircle size={14} />
                History
              </button>
            </article>
          ))
        )}

        {filtered.length > perPage ? (
          <footer className="autodm-pagination">
            <span>
              {(page - 1) * perPage + 1}-{Math.min(page * perPage, filtered.length)} of {filtered.length}
            </span>
            <div>
              <button type="button" className="btn-ghost" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>
                Prev
              </button>
              <button type="button" className="btn-ghost" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages}>
                Next
              </button>
            </div>
          </footer>
        ) : null}
      </section>

      {selectedContact ? (
        <MessageHistoryDialog
          contact={selectedContact}
          messages={messages}
          loading={messagesLoading}
          onClose={() => {
            setSelectedContact(null);
            setMessages([]);
          }}
        />
      ) : null}
    </div>
  );
}
