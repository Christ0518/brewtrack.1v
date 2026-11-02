"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/sidebar";
import api_links from "@/config/fetch_links/api_links.json";
import {
	FiEdit,
	FiTrash2,
	FiLock,
	FiUser,
	FiUserPlus,
	FiX,
	FiCheck,
	FiRefreshCw,
	FiSearch,
	FiUsers,
	FiShield,
} from "react-icons/fi";
import { Fetch_to } from "@/utilities";
import { useRouter } from "next/navigation";

type UserRole = "admin" | "cashier" | "kitchen";

type UserItem = {
	id: number;
	name: string;
	first_name: string;
	last_name: string;
	role: UserRole | string;
};

type UserFormState = {
	name: string;
	first_name: string;
	last_name: string;
	role: string;
	password: string;
};

type PasswordState = {
	id: number | null;
	current_password: string;
	new_password: string;
};

type ForgotPasswordState = {
	id: number | null;
	username: string;
	new_password: string;
};

type ModalState = {
	isOpen: boolean;
	type: "success" | "error" | "warning" | "info";
	title: string;
	message: string;
};

const SHOP_LABELS: Record<string, string> = {
	"1": "Barcelo",
	"2": "Good Coffee",
};

const normalizeShopId = (value: string | null | undefined) => {
	if (value === "2") return "2";
	return "1";
};

const defaultFormState: UserFormState = {
	name: "",
	first_name: "",
	last_name: "",
	role: "",
	password: "",
};

const defaultPasswordState: PasswordState = {
	id: null,
	current_password: "",
	new_password: "",
};

const defaultForgotPasswordState: ForgotPasswordState = {
	id: null,
	username: "",
	new_password: "",
};

export default function SettingsPage() {
	const router = useRouter();
	const [shopId, setShopId] = useState("1");
	const [shopLogo, setShopLogo] = useState("");
	const [users, setUsers] = useState<UserItem[]>([]);
	const [searchTerm, setSearchTerm] = useState("");
	const [roleFilter, setRoleFilter] = useState("all");
	const [form, setForm] = useState<UserFormState>(defaultFormState);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [passwordChange, setPasswordChange] = useState<PasswordState>(defaultPasswordState);
	const [forgotPassword, setForgotPassword] = useState<ForgotPasswordState>(defaultForgotPasswordState);
	const [showPasswordModal, setShowPasswordModal] = useState(false);
	const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
	const [showForm, setShowForm] = useState(false);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [modal, setModal] = useState<ModalState>({
		isOpen: false,
		type: "info",
		title: "",
		message: "",
	});

	const shopLabel = SHOP_LABELS[shopId] || "Barcelo";
	const accentInputClass = "w-full min-h-12 rounded-xl border border-[#E9DEDA] bg-[#FAF6F4] px-3.5 py-2.5 text-sm text-[#2D2626] outline-none transition-all placeholder:text-[#A08F89] focus:border-[#C98A84] focus:bg-white focus:ring-4 focus:ring-[#C98A84]/20";

	const showModal = (type: ModalState["type"], title: string, message: string) => {
		setModal({ isOpen: true, type, title, message });
	};

	const closeModal = () => {
		setModal((current) => ({ ...current, isOpen: false }));
	};

	useEffect(() => {
		const storedShopId = normalizeShopId(localStorage.getItem("shopId") || "1");

		setShopId(storedShopId);
		localStorage.setItem("shopId", storedShopId);
		localStorage.setItem("shopName", SHOP_LABELS[storedShopId]);
		setShopLogo(localStorage.getItem("shopLogo") || "");
		window.dispatchEvent(new Event("brewtrack-shop-updated"));
	}, []);

	useEffect(() => {
		const verify = async () => {
			const response = await Fetch_to(api_links.jwt.verify);
			if (!response.success) {
				router.push("/");
			}
		};

		verify();
	}, [router]);

	useEffect(() => {
		if (!shopId) return;
		fetchUsers();
	}, [shopId]);

	const fetchUsers = async () => {
		try {
			setLoading(true);

			const response = await fetch(`${api_links.tbl_users_manage}?shop_id=${shopId}`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					"x-shop-id": shopId,
				},
			});

			const json = await response.json().catch(() => null);
			if (!response.ok || !json?.success) {
				throw new Error(json?.message || "Failed to fetch users");
			}

			setUsers(Array.isArray(json.data) ? json.data : []);
		} catch (error) {
			console.error(error);
			showModal("error", "Load Error", error instanceof Error ? error.message : "Failed to fetch users");
		} finally {
			setLoading(false);
		}
	};

	const handleAddOrEdit = async () => {
		try {
			if (!form.name || !form.first_name || !form.last_name || !form.role) {
				showModal("warning", "Missing Fields", "Please fill in all required fields.");
				return;
			}

			if (!editingId && !form.password) {
				showModal("warning", "Password Required", "Password is required for new users.");
				return;
			}

			if (!editingId && form.password.length < 8) {
				showModal("warning", "Weak Password", "Password must be at least 8 characters.");
				return;
			}

			const method = editingId ? "PUT" : "POST";
			const payload = editingId
				? {
						id: editingId,
						name: form.name,
						first_name: form.first_name,
						last_name: form.last_name,
						role: form.role,
					}
				: {
						name: form.name,
						first_name: form.first_name,
						last_name: form.last_name,
						role: form.role,
						password: form.password,
					};

			setSubmitting(true);
			const result = await Fetch_to(
				api_links.tbl_users_manage,
				payload,
				{
					"x-shop-id": shopId,
					"Content-Type": "application/json",
				},
				1,
				0,
				method
			);

			if (!result.success) {
				showModal("error", "Save Failed", result.message || "Error saving user.");
				return;
			}

			showModal("success", "Saved", editingId ? "User updated successfully." : "User added successfully.");
			cancelEdit();
			await fetchUsers();
		} catch (error) {
			console.error(error);
			showModal("error", "Save Failed", error instanceof Error ? error.message : "Error saving user.");
		} finally {
			setSubmitting(false);
		}
	};

	const handleDelete = async (id: number) => {
		if (!window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;

		setSubmitting(true);
		try {
			const result = await Fetch_to(
				`${api_links.tbl_users_manage}?id=${id}`,
				{},
				{
					"x-shop-id": shopId,
					"Content-Type": "application/json",
				},
				1,
				0,
				"DELETE"
			);

			if (!result.success) {
				showModal("error", "Delete Failed", result.message || "Failed to delete user.");
				return;
			}

			showModal("success", "Deleted", "User deleted successfully.");
			await fetchUsers();
		} catch (error) {
			console.error(error);
			showModal("error", "Delete Failed", error instanceof Error ? error.message : "Failed to delete user.");
		} finally {
			setSubmitting(false);
		}
	};

	const handleChangePassword = async () => {
		try {
			if (!passwordChange.current_password || !passwordChange.new_password || !passwordChange.id) {
				showModal("warning", "Missing Fields", "Please fill in both password fields.");
				return;
			}

			if (passwordChange.new_password.length < 8) {
				showModal("warning", "Weak Password", "New password must be at least 8 characters.");
				return;
			}

			setSubmitting(true);
			const result = await Fetch_to(
				api_links.tbl_users_manage,
				{
					id: passwordChange.id,
					current_password: passwordChange.current_password,
					new_password: passwordChange.new_password,
					mode: "change",
				},
				{
					"x-shop-id": shopId,
					"Content-Type": "application/json",
				},
				1,
				0,
				"PATCH"
			);

			if (!result.success) {
				showModal("error", "Password Change Failed", result.message || "Failed to change password.");
				return;
			}

			showModal("success", "Password Updated", "Password changed successfully.");
			closePasswordModal();
		} catch (error) {
			console.error(error);
			showModal("error", "Password Change Failed", error instanceof Error ? error.message : "Failed to change password.");
		} finally {
			setSubmitting(false);
		}
	};

	const handleForgotPasswordReset = async () => {
		try {
			if (!forgotPassword.id || !forgotPassword.username || !forgotPassword.new_password) {
				showModal("warning", "Missing Fields", "Please fill in all fields for forgot password.");
				return;
			}

			const selectedUser = users.find((user) => user.id === forgotPassword.id);
			if (!selectedUser || selectedUser.name !== forgotPassword.username) {
				showModal("error", "Validation Failed", "Username does not match the selected user.");
				return;
			}

			if (forgotPassword.new_password.length < 8) {
				showModal("warning", "Weak Password", "New password must be at least 8 characters.");
				return;
			}

			setSubmitting(true);
			const result = await Fetch_to(
				api_links.tbl_users_manage,
				{
					id: forgotPassword.id,
					username: forgotPassword.username,
					new_password: forgotPassword.new_password,
					mode: "forgot",
				},
				{
					"x-shop-id": shopId,
					"Content-Type": "application/json",
				},
				1,
				0,
				"PATCH"
			);

			if (!result.success) {
				showModal("error", "Reset Failed", result.message || "Failed to reset password.");
				return;
			}

			showModal("success", "Password Reset", "Password reset successfully.");
			closeForgotPasswordModal();
		} catch (error) {
			console.error(error);
			showModal("error", "Reset Failed", error instanceof Error ? error.message : "Failed to reset password.");
		} finally {
			setSubmitting(false);
		}
	};

	const startEdit = (user: UserItem) => {
		setEditingId(user.id);
		setForm({
			name: user.name,
			first_name: user.first_name,
			last_name: user.last_name,
			role: ["admin", "cashier", "kitchen"].includes(user.role) ? user.role : "cashier",
			password: "",
		});
		setShowForm(true);
	};

	const cancelEdit = () => {
		setEditingId(null);
		setForm(defaultFormState);
		setShowForm(false);
	};

	const openPasswordModal = (userId: number) => {
		setPasswordChange({ ...defaultPasswordState, id: userId });
		setShowPasswordModal(true);
	};

	const closePasswordModal = () => {
		setPasswordChange(defaultPasswordState);
		setShowPasswordModal(false);
	};

	const openForgotPasswordModal = (user: UserItem) => {
		setForgotPassword({
			id: user.id,
			username: user.name,
			new_password: "",
		});
		setShowForgotPasswordModal(true);
	};

	const closeForgotPasswordModal = () => {
		setForgotPassword(defaultForgotPasswordState);
		setShowForgotPasswordModal(false);
	};

	const getRoleBadgeColor = (role: string) => {
		switch (role) {
			case "admin":
				return "bg-[#FBF2F0] text-[#A65F58] ring-[#E9DEDA]";
			case "cashier":
				return "bg-[#E5F1E9] text-[#477259] ring-[#D5E7DA]";
			case "kitchen":
				return "bg-[#FFF3DD] text-[#9A6B25] ring-[#F1DFC0]";
			default:
				return "bg-[#ECE6E2] text-[#796E6B] ring-[#E9DEDA]";
		}
	};

	const filteredUsers = useMemo(() => {
		const normalizedSearch = searchTerm.trim().toLowerCase();
		return users.filter((user) => {
			const matchesRole = roleFilter === "all" || user.role === roleFilter;
			const matchesSearch =
				!normalizedSearch ||
				`${user.first_name} ${user.last_name} ${user.name} ${user.role}`
					.toLowerCase()
					.includes(normalizedSearch);
			return matchesRole && matchesSearch;
		});
	}, [roleFilter, searchTerm, users]);

	const roleCounts = useMemo(
		() => ({
			all: users.length,
			admin: users.filter((user) => user.role === "admin").length,
			cashier: users.filter((user) => user.role === "cashier").length,
			kitchen: users.filter((user) => user.role === "kitchen").length,
		}),
		[users]
	);

	return (
		<div className="flex min-h-screen bg-[#FAF6F4] text-[#2D2626]">
			<Sidebar />

			<div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
				<div className="max-w-7xl mx-auto">
					<div className="mb-7">
						<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
							<div>
								<div className="flex items-center gap-3">
									<div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-[#FBF2F0] text-[#C98A84]">
										{shopLogo ? (
											<img src={shopLogo} alt="" className="h-full w-full object-cover" />
										) : (
											<FiUsers size={21} />
										)}
									</div>
									<div>
										<h1 className="text-2xl font-black tracking-tight text-[#2D2626] lg:text-3xl">User &amp; Staff Management</h1>
										<p className="mt-1 text-sm text-[#796E6B]">Manage team accounts and assigned roles for {shopLabel}</p>
									</div>
								</div>
							</div>
							{!showForm && (
								<button
									onClick={() => setShowForm(true)}
									className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#C98A84] px-5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#B97872] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C98A84]/30"
									disabled={submitting}
								>
									<FiUserPlus size={18} />
									Add New User
								</button>
							)}
						</div>
					</div>

					{showForm && (
						<div className="mb-5 rounded-2xl border border-[#E9DEDA] bg-white p-4 shadow-sm lg:p-6">
							<div className="flex items-center justify-between mb-4">
								<h3 className="flex items-center gap-2 text-lg font-black text-[#2D2626]">
									<span className="inline-flex text-[#C98A84]">{editingId ? <FiEdit size={18} /> : <FiUserPlus size={18} />}</span>
									{editingId ? "Edit User" : "Add New User"}
								</h3>
								<button
									onClick={cancelEdit}
									className="min-h-11 min-w-11 rounded-xl p-2 text-[#796E6B] transition-all hover:bg-[#FBF2F0] hover:text-[#2D2626]"
									aria-label="Close user form"
								>
									<FiX size={20} />
								</button>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="mb-2 block text-sm font-semibold text-[#4D413E]">
										Username <span className="text-red-600">*</span>
									</label>
									<input
										type="text"
										placeholder="Enter username"
										className={accentInputClass}
										value={form.name}
										onChange={(e) => setForm({ ...form, name: e.target.value })}
										required
									/>
								</div>

								<div>
									<label className="mb-2 block text-sm font-semibold text-[#4D413E]">
										First Name <span className="text-red-600">*</span>
									</label>
									<input
										type="text"
										placeholder="Enter first name"
										className={accentInputClass}
										value={form.first_name}
										onChange={(e) => setForm({ ...form, first_name: e.target.value })}
										required
									/>
								</div>

								<div>
									<label className="mb-2 block text-sm font-semibold text-[#4D413E]">
										Last Name <span className="text-red-600">*</span>
									</label>
									<input
										type="text"
										placeholder="Enter last name"
										className={accentInputClass}
										value={form.last_name}
										onChange={(e) => setForm({ ...form, last_name: e.target.value })}
										required
									/>
								</div>

								<div>
									<label className="mb-2 block text-sm font-semibold text-[#4D413E]">
										Role <span className="text-red-600">*</span>
									</label>
									<select
										className={`${accentInputClass} bg-white cursor-pointer`}
										value={form.role}
										onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
										required
									>
										<option value="">Select a role</option>
										<option value="admin">Admin</option>
										<option value="cashier">Cashier</option>
								<option value="kitchen">Kitchen</option>
									</select>
								</div>

								{!editingId && (
									<div className="md:col-span-2">
										<label className="mb-2 block text-sm font-semibold text-[#4D413E]">
											Password <span className="text-red-600">*</span>
										</label>
										<input
											type="password"
											placeholder="Enter password (minimum 8 characters)"
											className={accentInputClass}
											value={form.password}
											onChange={(e) => setForm({ ...form, password: e.target.value })}
											required
										/>
									</div>
								)}
							</div>

							<div className="mt-4 flex flex-col gap-3 border-t border-[#E9DEDA] pt-4 sm:flex-row">
								<button
									onClick={handleAddOrEdit}
									className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#C98A84] px-5 text-sm font-bold text-white transition-all hover:bg-[#B97872] disabled:bg-[#B7A8A3]"
									disabled={submitting}
								>
									<FiCheck size={16} />
									{editingId ? "Update User" : "Add User"}
								</button>
								<button
									onClick={cancelEdit}
									className="flex-1 rounded-xl border border-[#E9DEDA] px-5 py-2.5 text-sm font-bold text-[#796E6B] transition-all hover:bg-[#FBF2F0] sm:flex-none"
									disabled={submitting}
								>
									Cancel
								</button>
							</div>
						</div>
					)}

					<div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
						<div className="flex items-center gap-3 rounded-2xl border border-[#E9DEDA] bg-white p-4 shadow-sm">
							<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FBF2F0] text-[#C98A84]"><FiUsers size={19} /></div>
							<div><p className="text-xs font-semibold text-[#796E6B]">Team members</p><p className="text-xl font-black text-[#2D2626]">{roleCounts.all}</p></div>
						</div>
						<div className="flex items-center gap-3 rounded-2xl border border-[#E9DEDA] bg-white p-4 shadow-sm">
							<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E5F1E9] text-[#477259]"><FiUser size={19} /></div>
							<div><p className="text-xs font-semibold text-[#796E6B]">Cashiers</p><p className="text-xl font-black text-[#2D2626]">{roleCounts.cashier}</p></div>
						</div>
						<div className="flex items-center gap-3 rounded-2xl border border-[#E9DEDA] bg-white p-4 shadow-sm">
							<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF3DD] text-[#9A6B25]"><FiShield size={19} /></div>
							<div><p className="text-xs font-semibold text-[#796E6B]">Admins &amp; kitchen</p><p className="text-xl font-black text-[#2D2626]">{roleCounts.admin + roleCounts.kitchen}</p></div>
						</div>
					</div>

					<div className="overflow-hidden rounded-2xl border border-[#E9DEDA] bg-white shadow-sm">
						<div className="border-b border-[#E9DEDA] p-4 sm:p-5">
							<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
								<div>
									<h2 className="text-lg font-black text-[#2D2626]">Staff directory</h2>
									<p className="mt-1 text-sm text-[#796E6B]">Search team members and manage account access.</p>
								</div>
								<label className="relative block w-full lg:max-w-xs">
									<span className="sr-only">Search staff</span>
									<FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A08F89]" size={17} />
									<input
										type="search"
										value={searchTerm}
										onChange={(event) => setSearchTerm(event.target.value)}
										placeholder="Search name, username, role"
										className="min-h-11 w-full rounded-xl border border-[#E9DEDA] bg-[#FAF6F4] pl-10 pr-4 text-sm text-[#2D2626] outline-none placeholder:text-[#A08F89] focus:border-[#C98A84] focus:bg-white focus:ring-4 focus:ring-[#C98A84]/20"
									/>
								</label>
							</div>
							<div className="flex gap-2 overflow-x-auto pt-4" role="group" aria-label="Filter staff by role">
								{[
									{ id: "all", label: "All staff", count: roleCounts.all },
									{ id: "admin", label: "Admins", count: roleCounts.admin },
									{ id: "cashier", label: "Cashiers", count: roleCounts.cashier },
									{ id: "kitchen", label: "Kitchen", count: roleCounts.kitchen },
								].map((tab) => (
									<button
										key={tab.id}
										type="button"
										aria-pressed={roleFilter === tab.id}
										onClick={() => setRoleFilter(tab.id)}
										className={`min-h-10 shrink-0 rounded-xl px-4 text-sm font-bold transition-colors ${roleFilter === tab.id ? "bg-[#C98A84] text-white" : "bg-[#ECE6E2] text-[#796E6B] hover:bg-[#FBF2F0]"}`}
									>
										{tab.label}<span className={`ml-2 ${roleFilter === tab.id ? "text-[#FBE9E6]" : "text-[#A08F89]"}`}>{tab.count}</span>
									</button>
								))}
							</div>
						</div>

						{loading ? (
							<div className="py-12 text-center text-[#796E6B]">Loading users...</div>
						) : filteredUsers.length === 0 ? (
							<div className="text-center py-12">
								<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#ECE6E2]">
									<span className="inline-flex text-2xl text-[#A08F89]">
										<FiSearch />
									</span>
								</div>
								<p className="mb-1 text-base font-bold text-[#2D2626]">{users.length === 0 ? "No team members yet" : "No matching staff found"}</p>
								<p className="text-sm text-[#796E6B]">{users.length === 0 ? "Add a user to get your team started." : "Try another search or role filter."}</p>
							</div>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full min-w-[680px]">
									<thead className="border-b border-[#E9DEDA] bg-[#FAF6F4]">
										<tr>
											<th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-[#796E6B]">Staff member</th>
											<th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-[#796E6B]">Role</th>
											<th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-wide text-[#796E6B]">Account actions</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-[#F0E8E5]">
										{filteredUsers.map((user) => (
											<tr key={user.id} className="transition-colors hover:bg-[#FBF2F0]">
												<td className="px-5 py-4">
													<div className="flex items-center gap-3">
														<div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FBF2F0] text-sm font-black text-[#A65F58]">
															{`${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase() || <FiUser />}
														</div>
														<div>
															<div className="text-sm font-bold text-[#2D2626]">{user.first_name} {user.last_name}</div>
															<div className="mt-0.5 text-xs text-[#796E6B]">@{user.name} <span className="px-1 text-[#D8CCC8]">·</span> ID {user.id}</div>
														</div>
													</div>
												</td>
												<td className="px-5 py-4">
													<span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${getRoleBadgeColor(user.role)}`}>
														{user.role.charAt(0).toUpperCase() + user.role.slice(1)}
													</span>
												</td>
												<td className="px-5 py-4">
													<div className="flex gap-2 justify-end">
														<button
															onClick={() => startEdit(user)}
															className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#E9DEDA] text-[#796E6B] transition-all hover:border-[#C98A84] hover:bg-[#FBF2F0] hover:text-[#A65F58]"
															title="Edit user"
															aria-label={`Edit ${user.name}`}
															disabled={submitting}
														>
															<FiEdit size={16} />
														</button>
														<button
															onClick={() => openPasswordModal(user.id)}
															className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#E9DEDA] text-[#796E6B] transition-all hover:border-[#C98A84] hover:bg-[#FBF2F0] hover:text-[#A65F58]"
															title="Change password"
															aria-label={`Change password for ${user.name}`}
															disabled={submitting}
														>
															<FiLock size={16} />
														</button>
														<button
															onClick={() => openForgotPasswordModal(user)}
															className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#E9DEDA] text-[#796E6B] transition-all hover:border-[#C98A84] hover:bg-[#FBF2F0] hover:text-[#A65F58]"
															title="Forgot password reset"
															aria-label={`Reset password for ${user.name}`}
															disabled={submitting}
														>
															<FiRefreshCw size={16} />
														</button>
														<button
															onClick={() => handleDelete(user.id)}
															className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#F0C9C4] text-[#B97872] transition-all hover:bg-[#FBF2F0]"
															title="Delete user"
															aria-label={`Delete ${user.name}`}
															disabled={submitting}
														>
															<FiTrash2 size={16} />
														</button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>

					{showPasswordModal && passwordChange.id && (
						<div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
							<div className="w-full max-w-md rounded-3xl border border-[#E9DEDA] bg-white shadow-2xl">
								<div className="rounded-t-3xl border-b border-[#E9DEDA] bg-[#FAF6F4] px-5 py-4">
									<div className="flex items-center justify-between">
										<h3 className="flex items-center gap-2 text-lg font-black text-[#2D2626]">
											<FiLock size={18} />
											Change Password
										</h3>
										<button
											onClick={closePasswordModal}
											className="min-h-10 min-w-10 rounded-xl p-1.5 text-[#796E6B] transition-all hover:bg-[#FBF2F0]"
											aria-label="Close change password dialog"
										>
											<FiX size={20} />
										</button>
									</div>
								</div>

								<div className="space-y-4 p-5">
									<div>
										<label className="mb-2 block text-sm font-semibold text-[#4D413E]">Current Password <span className="text-red-600">*</span></label>
										<input
											type="password"
											placeholder="Enter current password"
											className={accentInputClass}
											value={passwordChange.current_password}
											onChange={(e) => setPasswordChange({ ...passwordChange, current_password: e.target.value })}
										/>
									</div>
									<div>
										<label className="mb-2 block text-sm font-semibold text-[#4D413E]">New Password <span className="text-red-600">*</span></label>
										<input
											type="password"
											placeholder="Enter new password (min 8 characters)"
											className={accentInputClass}
											value={passwordChange.new_password}
											onChange={(e) => setPasswordChange({ ...passwordChange, new_password: e.target.value })}
										/>
									</div>
								</div>

								<div className="flex gap-3 px-4 pb-4">
									<button
										onClick={closePasswordModal}
										className="flex-1 rounded-xl border border-[#E9DEDA] px-5 py-2.5 text-sm font-bold text-[#796E6B] transition-all hover:bg-[#FBF2F0]"
										disabled={submitting}
									>
										Cancel
									</button>
									<button
										onClick={handleChangePassword}
										className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#C98A84] px-5 text-sm font-bold text-white transition-all hover:bg-[#B97872] disabled:bg-[#B7A8A3]"
										disabled={submitting}
									>
										<FiCheck size={16} />
										Update Password
									</button>
								</div>
							</div>
						</div>
					)}

					{showForgotPasswordModal && forgotPassword.id && (
						<div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
							<div className="w-full max-w-md rounded-3xl border border-[#E9DEDA] bg-white shadow-2xl">
								<div className="rounded-t-3xl border-b border-[#E9DEDA] bg-[#FAF6F4] px-5 py-4">
									<div className="flex items-center justify-between">
										<h3 className="flex items-center gap-2 text-lg font-black text-[#2D2626]">
											<FiRefreshCw size={18} />
											Forgot Password Reset
										</h3>
										<button
											onClick={closeForgotPasswordModal}
											className="min-h-10 min-w-10 rounded-xl p-1.5 text-[#796E6B] transition-all hover:bg-[#FBF2F0]"
											aria-label="Close reset password dialog"
										>
											<FiX size={20} />
										</button>
									</div>
								</div>

								<div className="space-y-4 p-5">
									<p className="text-xs text-[#796E6B]">For security, confirm the username before setting a new password.</p>
									<div>
										<label className="mb-2 block text-sm font-semibold text-[#4D413E]">Username <span className="text-red-600">*</span></label>
										<input
											type="text"
											placeholder="Confirm username"
											className={accentInputClass}
											value={forgotPassword.username}
											onChange={(e) => setForgotPassword({ ...forgotPassword, username: e.target.value })}
										/>
									</div>
									<div>
										<label className="mb-2 block text-sm font-semibold text-[#4D413E]">New Password <span className="text-red-600">*</span></label>
										<input
											type="password"
											placeholder="Enter new password (min 8 characters)"
											className={accentInputClass}
											value={forgotPassword.new_password}
											onChange={(e) => setForgotPassword({ ...forgotPassword, new_password: e.target.value })}
										/>
									</div>
								</div>

								<div className="flex gap-3 px-4 pb-4">
									<button
										onClick={closeForgotPasswordModal}
										className="flex-1 rounded-xl border border-[#E9DEDA] px-5 py-2.5 text-sm font-bold text-[#796E6B] transition-all hover:bg-[#FBF2F0]"
										disabled={submitting}
									>
										Cancel
									</button>
									<button
										onClick={handleForgotPasswordReset}
										className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#C98A84] px-5 text-sm font-bold text-white transition-all hover:bg-[#B97872] disabled:bg-[#B7A8A3]"
										disabled={submitting}
									>
										<FiCheck size={16} />
										Reset Password
									</button>
								</div>
							</div>
						</div>
					)}

					{modal.isOpen && (
						<div className="fixed inset-0 z-60 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
							<div className="w-full max-w-md rounded-3xl border border-[#E9DEDA] bg-white p-6 shadow-2xl">
								<h3 className="mb-2 text-lg font-black text-[#2D2626]">{modal.title}</h3>
								<p className="mb-5 text-sm text-[#796E6B]">{modal.message}</p>
								<div className="flex justify-end">
									<button
										onClick={closeModal}
										className="min-h-11 rounded-xl bg-[#C98A84] px-5 font-bold text-white transition-colors hover:bg-[#B97872]"
									>
										OK
									</button>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
