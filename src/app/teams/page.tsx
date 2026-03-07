"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import { id } from "@instantdb/react";
import { useToast } from "@/components/Toast";

const AVATAR_STYLES = [
  { key: "initials", label: "Initials", urlFn: (name: string) => `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=14b88b,14b854,14afb8,1478b8,41b814` },
  { key: "pixel", label: "Pixel Art", urlFn: (name: string) => `https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(name)}` },
  { key: "micah", label: "Micah", urlFn: (name: string) => `https://api.dicebear.com/9.x/micah/svg?seed=${encodeURIComponent(name)}&backgroundColor=f0ede9,e5e7eb` },
  { key: "bottts", label: "Robot", urlFn: (name: string) => `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(name)}` },
  { key: "lorelei", label: "Lorelei", urlFn: (name: string) => `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(name)}` },
  { key: "notionists", label: "Notionist", urlFn: (name: string) => `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(name)}` },
  { key: "thumbs", label: "Thumbs", urlFn: (name: string) => `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(name)}` },
  { key: "shapes", label: "Shapes", urlFn: (name: string) => `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(name)}` },
  { key: "rings", label: "Rings", urlFn: (name: string) => `https://api.dicebear.com/9.x/rings/svg?seed=${encodeURIComponent(name)}` },
  { key: "identicon", label: "Identicon", urlFn: (name: string) => `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(name)}` },
];

export default function TeamsPage() {
  const { isLoading, error, data } = db.useQuery({
    teams: {
      members: {},
      assignedTasks: {},
    },
    profiles: {
      team: {},
      assignedTasks: {},
    },
  });

  const [draggedMemberId, setDraggedMemberId] = useState<string | null>(null);
  const [dragOverTeamId, setDragOverTeamId] = useState<string | null>(null);

  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Form states
  const [teamName, setTeamName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [memberSkills, setMemberSkills] = useState("");
  const [memberCapacity, setMemberCapacity] = useState("40");
  const [memberAvatarType, setMemberAvatarType] = useState("initials"); // avatar style key
  const [memberTeamId, setMemberTeamId] = useState("");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const { showToast } = useToast();

  // Edit/Delete states
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [teamToDelete, setTeamToDelete] = useState<any>(null);
  const [memberToDelete, setMemberToDelete] = useState<any>(null);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <div className="spinner" />
      </div>
    );
  }

  const teams = data?.teams || [];
  const allProfiles = data?.profiles || [];

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    db.transact(
      db.tx.teams[id()].update({
        name: teamName,
        createdAt: new Date(),
      })
    );
    showToast("Team created successfully");

    setTeamName("");
    setIsTeamModalOpen(false);
  };

  const handleEditTeamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !editingTeam) return;

    db.transact(
      db.tx.teams[editingTeam.id].update({
        name: teamName,
      })
    );

    showToast("Team updated successfully");
    setEditingTeam(null);
    setTeamName("");
    setIsTeamModalOpen(false);
  };

  const handleDeleteTeam = (team: any) => {
    if (team.members && team.members.length > 0) {
      showToast("Team contains active members. Remove members before deleting.", "error");
      return;
    }
    setTeamToDelete(team);
  };

  const confirmDeleteTeam = () => {
    if (!teamToDelete) return;
    db.transact(db.tx.teams[teamToDelete.id].delete());
    showToast("Team deleted successfully");
    setTeamToDelete(null);
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim() || !memberRole.trim() || !memberEmail.trim()) return;

    const profileId = id();

    const seed = encodeURIComponent(memberName.trim());
    const avatarStyle = AVATAR_STYLES.find(s => s.key === memberAvatarType) || AVATAR_STYLES[0];
    const avatarUrl = avatarStyle.urlFn(memberName.trim());

    const txs: any[] = [
      db.tx.profiles[profileId].update({
        name: memberName,
        email: memberEmail,
        role: memberRole,
        skills: memberSkills,
        capacity: parseInt(memberCapacity) || 40,
        status: "Available",
        avatarUrl,
        createdAt: new Date(),
      }),
    ];

    if (memberTeamId) {
      txs.push(db.tx.teams[memberTeamId].link({ members: profileId }));
    }

    db.transact(txs);
    showToast("Member added successfully");

    // Reset forms
    setMemberName("");
    setMemberEmail("");
    setMemberRole("");
    setMemberSkills("");
    setMemberCapacity("40");
    setMemberTeamId("");
    setIsMemberModalOpen(false);
  };

  const handleEditMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim() || !memberRole.trim() || !memberEmail.trim() || !editingProfile) return;

    const txs: any[] = [
      db.tx.profiles[editingProfile.id].update({
        name: memberName,
        email: memberEmail,
        role: memberRole,
        skills: memberSkills,
        capacity: parseInt(memberCapacity) || 40,
        avatarUrl: AVATAR_STYLES.find(s => s.key === memberAvatarType)?.urlFn(memberName.trim()) || editingProfile.avatarUrl,
      }),
    ];

    if (memberTeamId !== (editingProfile.team?.id || "")) {
      if (editingProfile.team?.id) {
        txs.push(db.tx.teams[editingProfile.team.id].unlink({ members: editingProfile.id }));
      }
      if (memberTeamId) {
        txs.push(db.tx.teams[memberTeamId].link({ members: editingProfile.id }));
      }
    }

    db.transact(txs);
    showToast("Member updated successfully");

    setEditingProfile(null);
    setMemberName("");
    setMemberEmail("");
    setMemberRole("");
    setMemberSkills("");
    setMemberCapacity("40");
    setMemberTeamId("");
    setIsMemberModalOpen(false);
  };

  const confirmDeleteMember = () => {
    if (!memberToDelete) return;
    db.transact(db.tx.profiles[memberToDelete.id].delete());
    showToast("Member deleted successfully");
    setMemberToDelete(null);
    if (selectedProfileId === memberToDelete.id) {
      setSelectedProfileId(null);
    }
  };

  const handleMoveMember = (memberId: string, teamId: string | null) => {
    const member = allProfiles.find(p => p.id === memberId);
    if (!member) return;

    const currentTeamId = member.team?.id;
    if (currentTeamId === teamId) return;

    const txs: any[] = [];
    if (currentTeamId) {
      txs.push(db.tx.teams[currentTeamId].unlink({ members: memberId }));
    }
    if (teamId) {
      txs.push(db.tx.teams[teamId].link({ members: memberId }));
    }

    db.transact(txs);
    showToast(`Member moved successfully`);
  };

  const activeProfile = selectedProfileId ? allProfiles.find(p => p.id === selectedProfileId) : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Team Organization</h1>
          <p style={{ color: "var(--text-secondary)", margin: "4px 0 0 0", fontSize: 14 }}>
            Manage engineering teams and developer profiles.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => setIsTeamModalOpen(true)}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Team
          </button>
          <button className="btn btn-primary" onClick={() => setIsMemberModalOpen(true)}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
            Add Member
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: activeProfile ? "2fr 1fr" : "1fr", gap: 24, transition: "grid-template-columns 0.3s ease" }}>
        {/* Left Side: Teams & Members */}
        <div>
          {teams.length === 0 && allProfiles.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" style={{ opacity: 0.5, marginBottom: 16 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
              <h3>No teams or members</h3>
              <p>Create a team and add members to start managing developer workload.</p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 16 }}>
                <button className="btn btn-primary" onClick={() => setIsTeamModalOpen(true)}>Create Team</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {teams.map((team) => (
                <div
                  key={team.id}
                  className={`card ${dragOverTeamId === team.id ? "drag-over" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOverTeamId(team.id); }}
                  onDragLeave={() => setDragOverTeamId(null)}
                  onDrop={() => {
                    if (draggedMemberId) {
                      handleMoveMember(draggedMemberId, team.id);
                    }
                    setDragOverTeamId(null);
                    setDraggedMemberId(null);
                  }}
                  style={{
                    transition: "all 0.2s ease",
                    boxShadow: dragOverTeamId === team.id ? "0 0 0 2px var(--color-emerald), 0 8px 16px -4px rgba(0,0,0,0.1)" : "none",
                    border: dragOverTeamId === team.id ? "1px solid transparent" : "1px solid var(--border-light)"
                  }}
                >
                  <div className="card-header" style={{ borderBottom: "1px solid var(--border-light)", paddingBottom: 16 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16 }}>{team.name}</h3>
                      <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
                        {team.members?.length || 0} Members • {(team.assignedTasks?.length || 0) + (team.members?.reduce((acc: number, p: any) => acc + (p.assignedTasks?.length || 0), 0) || 0)} Active Tasks
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: "6px 12px", fontSize: 12 }}
                        onClick={() => {
                          setMemberTeamId(team.id);
                          setIsMemberModalOpen(true);
                        }}
                      >
                        Add to Team
                      </button>
                      <button className="btn btn-secondary btn-icon" onClick={() => {
                        setEditingTeam(team);
                        setTeamName(team.name);
                        setIsTeamModalOpen(true);
                      }} title="Edit Team">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button className="btn btn-secondary btn-icon" onClick={() => handleDeleteTeam(team)} style={{ color: "var(--status-testing)", borderColor: "rgba(225, 29, 72, 0.2)" }} title="Delete Team">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="card-body" style={{ padding: "16px 20px" }}>
                    {!team.members || team.members.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-secondary)", fontSize: 14 }}>
                        No members in this team yet.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                        {team.members.map((profile: any) => (
                          <div
                            key={profile.id}
                            draggable
                            onDragStart={() => setDraggedMemberId(profile.id)}
                            onDragEnd={() => setDraggedMemberId(null)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              padding: 12,
                              borderRadius: "var(--radius-md)",
                              border: selectedProfileId === profile.id ? "1px solid var(--color-emerald)" : "1px solid var(--border-light)",
                              backgroundColor: selectedProfileId === profile.id ? "rgba(20, 184, 84, 0.05)" : "var(--bg-primary)",
                              cursor: "pointer",
                              transition: "all 0.2s ease"
                            }}
                            onClick={() => setSelectedProfileId(profile.id === selectedProfileId ? null : profile.id)}
                            className="hover-card"
                          >
                            <img
                              src={profile.avatarUrl}
                              alt={profile.name}
                              style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--bg-secondary)" }}
                            />
                            <div style={{ flex: 1, overflow: "hidden" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {profile.name}
                                </div>
                                <span className={`status-dot status-dot-${profile.status === "Available" ? "done" : profile.status === "Busy" ? "in_progress" : "backlog"}`} title={profile.status} />
                              </div>
                              <div style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {profile.role}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                                {profile.assignedTasks?.filter((t: any) => t.status === "in_progress").length || 0} active • Capacity: {profile.capacity} pts
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Unassigned Profiles */}
              <div
                className={`card ${dragOverTeamId === "unassigned" ? "drag-over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverTeamId("unassigned"); }}
                onDragLeave={() => setDragOverTeamId(null)}
                onDrop={() => {
                  if (draggedMemberId) {
                    handleMoveMember(draggedMemberId, null);
                  }
                  setDragOverTeamId(null);
                  setDraggedMemberId(null);
                }}
                style={{
                  transition: "all 0.2s ease",
                  boxShadow: dragOverTeamId === "unassigned" ? "0 0 0 2px var(--color-emerald)" : "none",
                  border: dragOverTeamId === "unassigned" ? "1px solid transparent" : "1px solid var(--border-light)",
                  display: (allProfiles.filter(p => !p.team).length > 0 || dragOverTeamId === "unassigned") ? "block" : "none"
                }}
              >
                <div className="card-header">
                  <h3 style={{ margin: 0, fontSize: 16 }}>Unassigned Members</h3>
                </div>
                <div className="card-body" style={{ padding: "16px 20px" }}>
                  {allProfiles.filter(p => !p.team).length === 0 ? (
                    <div style={{ textAlign: "center", padding: "12px 0", color: "var(--text-tertiary)", fontSize: 13, border: "1px dashed var(--border-light)", borderRadius: "var(--radius-sm)" }}>
                      Drop members here to unassign them
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                      {allProfiles.filter(p => !p.team).map((profile) => (
                        <div
                          key={profile.id}
                          draggable
                          onDragStart={() => setDraggedMemberId(profile.id)}
                          onDragEnd={() => setDraggedMemberId(null)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: 12,
                            borderRadius: "var(--radius-md)",
                            border: selectedProfileId === profile.id ? "1px solid var(--color-emerald)" : "1px solid var(--border-light)",
                            backgroundColor: selectedProfileId === profile.id ? "rgba(20, 184, 84, 0.05)" : "var(--bg-primary)",
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                          }}
                          onClick={() => setSelectedProfileId(profile.id === selectedProfileId ? null : profile.id)}
                          className="hover-card"
                        >
                          <img
                            src={profile.avatarUrl}
                            alt={profile.name}
                            style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--bg-secondary)" }}
                          />
                          <div style={{ flex: 1, overflow: "hidden" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {profile.name}
                              </div>
                              <span className={`status-dot status-dot-${profile.status === "Available" ? "done" : profile.status === "Busy" ? "in_progress" : "backlog"}`} title={profile.status} />
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {profile.role}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Profile Details pane */}
        {activeProfile && (
          <div className="card" style={{ alignSelf: "start", position: "sticky", top: 32 }}>
            <div className="card-body" style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    setEditingProfile(activeProfile);
                    setMemberName(activeProfile.name);
                    setMemberEmail(activeProfile.email || "");
                    setMemberRole(activeProfile.role || "");
                    setMemberSkills(activeProfile.skills || "");
                    setMemberCapacity(activeProfile.capacity?.toString() || "40");
                    setMemberAvatarType("initials");
                    setMemberTeamId(activeProfile.team?.id || "");
                    setIsMemberModalOpen(true);
                  }}>Edit</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setMemberToDelete(activeProfile)} style={{ color: "var(--status-testing)", borderColor: "var(--status-testing)" }}>Delete</button>
                </div>
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}
                  onClick={() => setSelectedProfileId(null)}
                >
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginTop: -10 }}>
                <img
                  src={activeProfile.avatarUrl}
                  alt={activeProfile.name}
                  style={{ width: 80, height: 80, borderRadius: "50%", border: "4px solid var(--bg-primary)", boxShadow: "0 0 0 1px var(--border-light)" }}
                />
                <h2 style={{ fontSize: 20, margin: "12px 0 4px 0" }}>{activeProfile.name}</h2>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  style={{ fontSize: 11, padding: "2px 8px", marginBottom: 4 }}
                >
                  Change Avatar
                </button>
                {showAvatarPicker && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, padding: 12, background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", marginBottom: 8 }}>
                    {AVATAR_STYLES.map(style => (
                      <div
                        key={style.key}
                        onClick={() => {
                          const newUrl = style.urlFn(activeProfile.name);
                          db.transact(db.tx.profiles[activeProfile.id].update({ avatarUrl: newUrl }));
                          showToast("Avatar updated!");
                          setShowAvatarPicker(false);
                        }}
                        style={{
                          cursor: "pointer",
                          textAlign: "center",
                          padding: 4,
                          borderRadius: "var(--radius-sm)",
                          border: "2px solid transparent",
                          transition: "all 0.15s ease",
                        }}
                        className="hover-card"
                        title={style.label}
                      >
                        <img src={style.urlFn(activeProfile.name)} style={{ width: 36, height: 36, borderRadius: "50%" }} alt={style.label} />
                        <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 2 }}>{style.label}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>{activeProfile.role}</div>
                <div className={`badge badge-${activeProfile.status === "Available" ? "low" : activeProfile.status === "Busy" ? "medium" : "high"}`} style={{ padding: "4px 12px" }}>
                  {activeProfile.status}
                </div>
              </div>

              <div style={{ marginTop: 32 }}>
                <h4 style={{ fontSize: 12, textTransform: "uppercase", color: "var(--text-tertiary)", letterSpacing: "0.5px", marginBottom: 12 }}>Contact Info</h4>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)", marginBottom: 8 }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ color: "var(--text-secondary)" }}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>
                  {activeProfile.email}
                </div>
                {activeProfile.phone && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)" }}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ color: "var(--text-secondary)" }}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.896-1.596-5.48-4.08-7.074-6.97l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" /></svg>
                    {activeProfile.phone}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 24 }}>
                <h4 style={{ fontSize: 12, textTransform: "uppercase", color: "var(--text-tertiary)", letterSpacing: "0.5px", marginBottom: 12 }}>Skills & Capacity</h4>
                <div style={{ fontSize: 13, marginBottom: 12 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Skills: </span>
                  {activeProfile.skills || "Not specified"}
                </div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Capacity: </span>
                  {activeProfile.capacity} points / sprint
                </div>
              </div>

              <div style={{ marginTop: 24 }}>
                <h4 style={{ fontSize: 12, textTransform: "uppercase", color: "var(--text-tertiary)", letterSpacing: "0.5px", marginBottom: 12 }}>Current Workload</h4>
                <div className="metrics-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: "var(--bg-secondary)", padding: 12, borderRadius: "var(--radius-md)", textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                      {activeProfile.assignedTasks?.filter((t: any) => t.status === "in_progress").length || 0}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>In Progress</div>
                  </div>
                  <div style={{ background: "var(--bg-secondary)", padding: 12, borderRadius: "var(--radius-md)", textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                      {activeProfile.assignedTasks?.filter((t: any) => t.status === "done").length || 0}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Completed</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "12px", background: "var(--bg-secondary)" }}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>Active Tasks:</div>
                  {(!activeProfile.assignedTasks || activeProfile.assignedTasks.length === 0) ? (
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No tasks assigned.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {activeProfile.assignedTasks.slice(0, 3).map((task: any) => (
                        <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                          <span className={`status-dot status-dot-${task.status}`}></span>
                          <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                            {task.title}
                          </div>
                        </div>
                      ))}
                      {activeProfile.assignedTasks.length > 3 && (
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "center", marginTop: 4 }}>
                          +{activeProfile.assignedTasks.length - 3} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {isTeamModalOpen && (
        <div className="modal-overlay" onClick={() => { setIsTeamModalOpen(false); setEditingTeam(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTeam ? "Edit Team" : "Create New Team"}</h2>
            </div>
            <form onSubmit={editingTeam ? handleEditTeamSubmit : handleCreateTeam} className="modal-body form-group">
              <div>
                <label className="form-label">Team Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Backend Team"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="modal-footer" style={{ marginTop: 24 }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setIsTeamModalOpen(false); setEditingTeam(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!teamName.trim()}>
                  {editingTeam ? "Save Changes" : "Create Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isMemberModalOpen && (
        <div className="modal-overlay" onClick={() => { setIsMemberModalOpen(false); setEditingProfile(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>{editingProfile ? "Edit Team Member" : "Add Team Member"}</h2>
            </div>
            <form onSubmit={editingProfile ? handleEditMemberSubmit : handleAddMember} className="modal-body form-group" style={{ maxHeight: "70vh", overflowY: "auto" }}>
              <div>
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Rahul Sharma"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="rahul@example.com"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Role</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Backend Developer"
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Assign to Team</label>
                <select
                  className="form-input"
                  value={memberTeamId}
                  onChange={(e) => setMemberTeamId(e.target.value)}
                >
                  <option value="">-- No Team (Unassigned) --</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Skills (Comma separated)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Node.js, PostgreSQL, APIs"
                  value={memberSkills}
                  onChange={(e) => setMemberSkills(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="form-label">Sprint Capacity (Pts)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="40"
                    value={memberCapacity}
                    onChange={(e) => setMemberCapacity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Avatar Style</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, padding: 8, background: "var(--bg-secondary)", borderRadius: "var(--radius-md)" }}>
                    {AVATAR_STYLES.map(style => (
                      <div
                        key={style.key}
                        onClick={() => setMemberAvatarType(style.key)}
                        style={{
                          cursor: "pointer",
                          textAlign: "center",
                          padding: 4,
                          borderRadius: "var(--radius-sm)",
                          border: memberAvatarType === style.key ? "2px solid var(--color-emerald)" : "2px solid transparent",
                          background: memberAvatarType === style.key ? "rgba(20, 184, 84, 0.08)" : "transparent",
                          transition: "all 0.15s ease",
                        }}
                        title={style.label}
                      >
                        <img src={style.urlFn(memberName.trim() || "User")} style={{ width: 32, height: 32, borderRadius: "50%" }} alt={style.label} />
                        <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 1 }}>{style.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: 24 }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setIsMemberModalOpen(false); setEditingProfile(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!memberName.trim() || !memberEmail.trim() || !memberRole.trim()}>
                  {editingProfile ? "Save Changes" : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Overlays */}
      {teamToDelete && (
        <div className="modal-overlay" onClick={() => setTeamToDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h2>Delete Team</h2></div>
            <div className="modal-body"><p>Are you sure you want to delete this team?</p></div>
            <div className="modal-footer" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setTeamToDelete(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmDeleteTeam} style={{ background: "var(--status-testing)" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {memberToDelete && (
        <div className="modal-overlay" onClick={() => setMemberToDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h2>Delete Team Member</h2></div>
            <div className="modal-body"><p>Delete this team member?</p></div>
            <div className="modal-footer" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setMemberToDelete(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmDeleteMember} style={{ background: "var(--status-testing)" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
