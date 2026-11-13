import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { MessageCircle, Plus, Trash2, X, Clock, FileText, Image as ImageIcon, Layers, MousePointer, Type, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/utils/apiClient';
import { responseIssue } from './editorHelpers';

function generateId(prefix = 'item') {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

const StepBadge = ({ step }) => <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#111111] text-sm font-semibold text-white">{step}</span>;
const EditorInfo = ({ text }) => <span className="hidden"/>;

function ImageUrlField({ label, value, onChange, placeholder = 'https://...' }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await apiClient.post('/api/autodm/assets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(data.url);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Image upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label className="block">{label}</Label>
      <div className="rounded-lg border border-[#d3cec6] bg-[#f5f1ec] p-2">
        {value ? (
          <img src={value} alt="" className="mb-2 h-28 w-full rounded-md border border-[#d3cec6] bg-white object-cover" />
        ) : null}
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
          <Button type="button" variant="outline" className="rounded-md" disabled={uploading} onClick={() => inputRef.current?.click()}>
            <UploadCloud className="mr-2 h-4 w-4" />
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => uploadImage(event.target.files?.[0])} />
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}

const responseBackgrounds = {
  text: '/assets/text%20message.png',
  image: '/assets/Image.png',
  card: '/assets/Card.png',
  carousel: '/assets/curosal.png',
  buttons: '/assets/Buttons.png',
  lead_form: '/assets/Lead%20Form.png',
  delay: '/assets/delay.png',
};

const responseTypes = [
  { type: 'text', label: 'Text Message', shortLabel: 'Text', icon: Type, description: 'Send a simple text message' },
  { type: 'image', label: 'Image', shortLabel: 'Image', icon: ImageIcon, description: 'Send an image with optional text' },
  { type: 'card', label: 'Card', shortLabel: 'Card', icon: FileText, description: 'Rich card with image, title, and buttons' },
  { type: 'carousel', label: 'Carousel', shortLabel: 'Carousel', icon: Layers, description: 'Multiple cards in a swipeable carousel' },
  { type: 'buttons', label: 'Buttons', shortLabel: 'Buttons', icon: MousePointer, description: 'Quick reply buttons or links' },
  { type: 'lead_form', label: 'Lead Form', shortLabel: 'Lead Form', icon: FileText, description: 'Capture lead information' },
  { type: 'delay', label: 'Delay', shortLabel: 'Delay', icon: Clock, description: 'Wait before sending next message' },
];

function createResponseNode(type) {
  const id = generateId('node');
  if (type === 'text') return { id, type, content: '' };
  if (type === 'image') return { id, type, image_url: '', content: '' };
  if (type === 'card') {
    return {
      id,
      type,
      card_image_url: '',
      card_title: '',
      card_subtitle: '',
      buttons: [{ id: generateId('button'), type: 'postback', title: 'SETUP', payload: 'setup' }],
    };
  }
  if (type === 'buttons') {
    return {
      id,
      type,
      content: 'Choose an option below.',
      buttons: [{ id: generateId('button'), type: 'url', title: 'Open link', url: '' }],
    };
  }
  if (type === 'carousel') return { id, type, items: [createCarouselItem()] };
  if (type === 'lead_form') return { id, type, form_title: 'Lead form', form_fields: [] };
  return { id, type: 'delay', delay_seconds: 5 };
}

function createCarouselItem() {
  return {
    id: generateId('carousel'),
    image_url: '',
    title: '',
    subtitle: '',
    buttons: [{ id: generateId('button'), type: 'url', title: '', url: '' }],
  };
}

function responseSummary(node) {
  if (node.type === 'text') return node.content || 'No text added yet';
  if (node.type === 'image') return node.content || node.image_url || 'Image response';
  if (node.type === 'card') return node.card_title || 'Card response';
  if (node.type === 'buttons') return node.content || `${node.buttons?.length || 0} button(s)`;
  if (node.type === 'carousel') return `${node.items?.length || 0} item(s)`;
  if (node.type === 'lead_form') return node.form_title || 'Lead form';
  if (node.type === 'delay') return `${node.delay_seconds || 5} second delay`;
  return 'Response';
}

function ResponseFlowBuilder({ responseFlow, onChange, step, hideHeader = false, compact = false }) {
  const nodes = responseFlow?.nodes || [];
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingNode, setEditingNode] = useState(null);

  const updateNode = (draft) => {
    onChange({
      ...responseFlow,
      nodes: nodes.map((node) => (node.id === draft.id ? draft : node)),
    });
    setEditingNode(null);
  };

  const removeNode = (nodeId) => {
    onChange({ ...responseFlow, nodes: nodes.filter((node) => node.id !== nodeId) });
  };

  const addNode = (type) => {
    const node = createResponseNode(type);
    onChange({ ...responseFlow, nodes: [...nodes, node] });
    setPickerOpen(false);
    setEditingNode(node);
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(nodes);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    onChange({ ...responseFlow, nodes: items });
  };

  return (
    <Card className={`overflow-hidden ${hideHeader ? "border-0 shadow-none bg-transparent" : "rounded-lg border-black/10 shadow-sm"}`}>
      {!hideHeader && (
        <CardHeader className="border-b border-black/10 bg-white">
        <CardTitle className="flex flex-wrap items-center gap-2 text-[22px] font-semibold text-[var(--ink)]">
          <StepBadge step={step} />
          Response Flow
          <Badge variant="secondary" className="rounded-md bg-primary/10 text-primary">
            Editable
          </Badge>
          <EditorInfo text="Build the automated DM sequence sent after the trigger. Add text, image, card, buttons, carousel, lead form, or delay steps." />
        </CardTitle>
        <p className="text-sm text-[var(--slate)]">Click any response row to edit its text, image, buttons, or fields.</p>
      </CardHeader>
      )}
      <CardContent className={`space-y-3 ${hideHeader ? 'p-0' : 'p-5'}`}>

          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="response-nodes">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                  {nodes.length === 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-amber-900">
                      <MessageCircle className="mx-auto mb-2 h-8 w-8 text-amber-500 opacity-80" />
                      <p className="font-medium">No response added</p>
                      <p className="mt-1 text-sm opacity-90">Please add at least one response (like Text or Card) below so the automation can reply.</p>
                    </div>
                  )}
                  {nodes.map((node, index) => {
                    const config = responseTypes.find((item) => item.type === node.type) || responseTypes[0];
                    return (
                      <Draggable key={node.id} draggableId={node.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            style={{ ...provided.draggableProps.style }}
                            className={`grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-black/10 bg-white p-3 ${snapshot.isDragging ? 'shadow-lg z-10' : ''}`}
                          >
                            <div {...provided.dragHandleProps} aria-label={`Reorder response ${index + 1}`} title="Drag to reorder" className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-full border border-black/15 text-xs font-medium tabular-nums text-gray-500 outline-none focus-visible:ring-2 focus-visible:ring-black active:cursor-grabbing">
                              {index + 1}
                            </div>
                            <button type="button" onClick={() => setEditingNode({ ...node })} aria-label={`Edit ${config.shortLabel.toLowerCase()} response ${index + 1}`} className="min-w-0 overflow-hidden text-left focus-visible:outline-none focus-visible:underline">
                              <span className="block truncate text-sm font-medium text-[var(--ink)]">{config.shortLabel}</span>
                              <span className={`mt-0.5 line-clamp-1 break-words text-[13px] leading-5 ${responseIssue(node) ? 'text-red-600' : 'text-[var(--slate)]'}`}>{responseIssue(node) || responseSummary(node)}</span>
                            </button>
                            <div className="flex items-center gap-1">
                              <button type="button" aria-label={`Edit response ${index + 1}`} onClick={() => setEditingNode({ ...node })} className="rounded-md px-2 py-2 text-xs font-medium text-gray-600 hover:bg-black/5 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black">Edit</button>
                              <button type="button" aria-label={`Delete response ${index + 1}`} onClick={() => removeNode(node.id)} className="rounded-md px-2 py-2 text-xs font-medium text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">Delete</button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

        <Button type="button" variant="outline" className="h-11 w-full rounded-md border-dashed" onClick={() => setPickerOpen(true)}>
          Add Response
        </Button>
      </CardContent>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto rounded-lg bg-white">
          <DialogHeader>
            <DialogTitle>Add Response Element</DialogTitle>
            <DialogDescription className="sr-only">Choose a response type to add.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-3">
            {responseTypes.map((item) => {
              return (
                <button
                  key={item.type}
                  type="button"
                  className="group relative flex min-h-[140px] flex-col justify-end overflow-hidden rounded-lg border border-black/10 bg-white text-center transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => addNode(item.type)}
                >
                  <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-10 h-[168px] bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url("${responseBackgrounds[item.type]}")` }} />
                  <span className="relative z-10 block w-full bg-white/95 px-3 py-2.5">
                    <span className="block font-medium text-[var(--ink)]">{item.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <ResponseEditorDialog node={editingNode} open={Boolean(editingNode)} onOpenChange={(open) => !open && setEditingNode(null)} onSave={updateNode} />
    </Card>
  );
}

function ResponseEditorDialog({ node, open, onOpenChange, onSave }) {
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    setDraft(node ? { ...node } : null);
  }, [node]);

  if (!draft) return null;

  const addButton = () => {
    setDraft({
      ...draft,
      buttons: [...(draft.buttons || []), { id: generateId('button'), type: 'url', title: '', url: '' }],
    });
  };

  const updateButton = (buttonId, updates) => {
    setDraft({
      ...draft,
      buttons: (draft.buttons || []).map((button) => (button.id === buttonId ? { ...button, ...updates } : button)),
    });
  };

  const removeButton = (buttonId) => {
    setDraft({ ...draft, buttons: (draft.buttons || []).filter((button) => button.id !== buttonId) });
  };

  const carouselItems = draft.items?.length ? draft.items : [createCarouselItem()];

  const updateCarouselItem = (itemId, updates) => {
    setDraft({
      ...draft,
      items: carouselItems.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
    });
  };

  const removeCarouselItem = (itemId) => {
    setDraft({ ...draft, items: carouselItems.filter((item) => item.id !== itemId) });
  };

  const updateCarouselButton = (itemId, buttonId, updates) => {
    updateCarouselItem(itemId, {
      buttons: (carouselItems.find((item) => item.id === itemId)?.buttons || []).map((button) =>
        button.id === buttonId ? { ...button, ...updates } : button
      ),
    });
  };

  const addCarouselButton = (itemId) => {
    const item = carouselItems.find((entry) => entry.id === itemId);
    updateCarouselItem(itemId, {
      buttons: [...(item?.buttons || []), { id: generateId('button'), type: 'url', title: '', url: '' }],
    });
  };

  const removeCarouselButton = (itemId, buttonId) => {
    const item = carouselItems.find((entry) => entry.id === itemId);
    updateCarouselItem(itemId, { buttons: (item?.buttons || []).filter((button) => button.id !== buttonId) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-lg bg-white">
        <DialogHeader>
          <DialogTitle>Edit {responseTypes.find((item) => item.type === draft.type)?.shortLabel || 'Response'}</DialogTitle>
          <DialogDescription>Update the content used in this response step.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {draft.type === 'text' && (
            <div>
              <Label className="mb-2 block">Message text</Label>
              <Textarea value={draft.content || ''} onChange={(event) => setDraft({ ...draft, content: event.target.value })} rows={5} />
            </div>
          )}

          {draft.type === 'image' && (
            <>
              <ImageUrlField label="Image" value={draft.image_url || ''} onChange={(image_url) => setDraft({ ...draft, image_url })} />
              <div>
                <Label className="mb-2 block">Caption</Label>
                <Textarea value={draft.content || ''} onChange={(event) => setDraft({ ...draft, content: event.target.value })} rows={3} />
              </div>
            </>
          )}

          {draft.type === 'card' && (
            <>
              <ImageUrlField label="Card image" value={draft.card_image_url || ''} onChange={(card_image_url) => setDraft({ ...draft, card_image_url })} />
              <div>
                <Label className="mb-2 block">Card title</Label>
                <Input value={draft.card_title || ''} onChange={(event) => setDraft({ ...draft, card_title: event.target.value })} />
              </div>
              <div>
                <Label className="mb-2 block">Card subtitle</Label>
                <Textarea value={draft.card_subtitle || ''} onChange={(event) => setDraft({ ...draft, card_subtitle: event.target.value })} rows={3} />
              </div>
            </>
          )}

          {draft.type === 'buttons' && (
            <div>
              <Label className="mb-2 block">Message text</Label>
              <Textarea value={draft.content || ''} onChange={(event) => setDraft({ ...draft, content: event.target.value })} rows={3} />
            </div>
          )}

          {['card', 'buttons', 'text'].includes(draft.type) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Buttons</Label>
                <Button type="button" variant="outline" size="sm" className="rounded-md" onClick={addButton}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Button
                </Button>
              </div>
              {(draft.buttons || []).map((button) => (
                <div key={button.id} className="grid gap-2 sm:grid-cols-[1fr_120px_1fr_36px] items-center rounded-lg border border-black/10 bg-black/[0.02] p-2">
                  <Input value={button.title || ''} onChange={(event) => updateButton(button.id, { title: event.target.value })} placeholder="Button text" />
                  <select
                    className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm"
                    value={button.type || 'url'}
                    onChange={(event) => updateButton(button.id, { type: event.target.value })}
                  >
                    <option value="url">URL</option>
                    <option value="postback">Postback</option>
                  </select>
                  <Input
                    value={button.type === 'postback' ? button.payload || '' : button.url || ''}
                    onChange={(event) =>
                      updateButton(button.id, button.type === 'postback' ? { payload: event.target.value } : { url: event.target.value })
                    }
                    placeholder={button.type === 'postback' ? 'Payload' : 'https://...'}
                  />
                  <Button type="button" variant="ghost" size="icon" className="rounded-md text-red-600 h-10 w-10" onClick={() => removeButton(button.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {draft.type === 'carousel' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Add one or more carousel cards. Each card can have an image, title, subtitle, and optional action buttons.
              </div>
              {carouselItems.map((item, index) => (
                <div key={item.id} className="space-y-3 rounded-lg border border-black/10 bg-black/[0.02] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Carousel card {index + 1}</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove carousel card"
                      className="h-8 w-8 rounded-md text-red-600"
                      disabled={carouselItems.length === 1}
                      onClick={() => removeCarouselItem(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <ImageUrlField label="Card image" value={item.image_url || ''} onChange={(image_url) => updateCarouselItem(item.id, { image_url })} />
                  <Input value={item.title || ''} onChange={(event) => updateCarouselItem(item.id, { title: event.target.value })} placeholder="Card title" />
                  <Textarea
                    value={item.subtitle || ''}
                    onChange={(event) => updateCarouselItem(item.id, { subtitle: event.target.value })}
                    placeholder="Card subtitle"
                    rows={2}
                  />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Buttons</Label>
                      <Button type="button" variant="outline" size="sm" className="rounded-md" onClick={() => addCarouselButton(item.id)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Button
                      </Button>
                    </div>
                    {(item.buttons || []).map((button) => (
                      <div key={button.id} className="grid gap-2 sm:grid-cols-[1fr_120px_1fr_36px]">
                        <Input
                          value={button.title || ''}
                          onChange={(event) => updateCarouselButton(item.id, button.id, { title: event.target.value })}
                          placeholder="Button text"
                        />
                        <select
                          className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm"
                          value={button.type || 'url'}
                          onChange={(event) => updateCarouselButton(item.id, button.id, { type: event.target.value })}
                        >
                          <option value="url">URL</option>
                          <option value="postback">Postback</option>
                        </select>
                        <Input
                          value={button.type === 'postback' ? button.payload || '' : button.url || ''}
                          onChange={(event) =>
                            updateCarouselButton(
                              item.id,
                              button.id,
                              button.type === 'postback' ? { payload: event.target.value } : { url: event.target.value }
                            )
                          }
                          placeholder={button.type === 'postback' ? 'Payload' : 'https://...'}
                        />
                        <Button type="button" variant="ghost" size="icon" className="rounded-md text-red-600" onClick={() => removeCarouselButton(item.id, button.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-md border-dashed"
                onClick={() => setDraft({ ...draft, items: [...carouselItems, createCarouselItem()] })}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Carousel Card
              </Button>
            </div>
          )}

          {draft.type === 'lead_form' && (
            <div>
              <Label className="mb-2 block">Form title</Label>
              <Input value={draft.form_title || ''} onChange={(event) => setDraft({ ...draft, form_title: event.target.value })} />
            </div>
          )}

          {draft.type === 'delay' && (
            <div>
              <Label className="mb-2 block">Delay in seconds</Label>
              <Input type="number" min={1} max={60} value={draft.delay_seconds || 5} onChange={(event) => setDraft({ ...draft, delay_seconds: Number(event.target.value) || 5 })} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-md" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="rounded-md" onClick={() => onSave(draft)}>
            Save response
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ResponseFlowBuilder };
export default ResponseFlowBuilder;
