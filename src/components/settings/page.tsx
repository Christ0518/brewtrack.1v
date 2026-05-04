"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/sidebar";
import api_links from "@/config/fetch_links/api_links.json";
import { FiEdit, FiTrash2, FiLock, FiUser, FiUserPlus, FiX, FiCheck, FiRefreshCw } from "react-icons/fi";
import { Fetch_to } from "@/utilities";
import { useRouter } from "next/navigation";
import { getShopTheme } from "@/lib/theme";

type UserRole = "admin" ;

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
	const [shopColor, setShopColor] = useState("#073dbe");
	const [users, setUsers] = useState<UserItem[]>([]);
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

	const theme = useMemo(() => getShopTheme(shopId), [shopId]);
	const shopLabel = SHOP_LABELS[shopId] || "Barcelo";
	const accentInputClass = `w-full px-3 py-2.5 border border-slate-300 rounded-lg ${theme.accentRingClass} transition-all outline-none text-sm`;

	const showModal = (type: ModalState["type"], title: string, message: string) => {
		setModal({ isOpen: true, type, title, message });
	};

	const closeModal = () => {
		setModal((current) => ({ ...current, isOpen: false }));
	};

	useEffect(() => {
		const storedShopId = normalizeShopId(localStorage.getItem("shopId") || "1");
		const storedShopColor = localStorage.getItem("shopColor");
		const fallbackTheme = getShopTheme(storedShopId);

		setShopId(storedShopId);
		localStorage.setItem("shopId", storedShopId);
		localStorage.setItem("shopName", SHOP_LABELS[storedShopId]);
		setShopColor(storedShopColor || fallbackTheme.accentColor);
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

			setSubmitting(true);

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

		try {
			setSubmitting(true);
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

			showModal("success", "Password Reset", "Forgot-password reset completed successfully.");
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
			role: user.role === "admin" ? "admin" : "cashier",
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
				return "bg-slate-200 text-slate-900";
			case "cashier":
				return theme.accentSoftClass;
			default:
				return "bg-slate-100 text-slate-700";
		}
	};

	return (
		<div className="flex h-screen bg-slate-50">
			<Sidebar />

			<div className="flex-1 overflow-auto p-4 lg:p-6">
				<div className="max-w-7xl mx-auto">
					<div className="mb-6">
						<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
							<div>
								<h1 className="text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-3">
									<div className="p-2.5 rounded-lg" style={{ backgroundColor: shopColor }}>
										<span className={theme.accentTextColor === "#0f172a" ? "text-slate-900 text-xl inline-flex" : "text-white text-xl inline-flex"}>
											<FiUser />
										</span>
									</div>
									User Management
								</h1>
								<p className="text-slate-600 mt-1 text-sm">Manage your team members and their access for {shopLabel}</p>
							</div>
							{!showForm && (
								<button
									onClick={() => setShowForm(true)}
									className="px-5 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 font-medium text-sm"
									style={{ backgroundColor: shopColor, color: "white" }}
									disabled={submitting}
								>
									<FiUserPlus size={18} />
									Add New User
								</button>
							)}
						</div>
					</div>

					{showForm && (
						<div className="bg-white rounded-lg border border-slate-200 p-4 lg:p-6 mb-4">
							<div className="flex items-center justify-between mb-4">
								<h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
									<span style={{ color: shopColor, display: "inline-flex" }}>
										{editingId ? <FiEdit size={18} /> : <FiUserPlus size={18} />}
									</span>
									{editingId ? "Edit User" : "Add New User"}
								</h3>
								<button
									onClick={cancelEdit}
									className="text-slate-600 hover:text-slate-800 p-2 hover:bg-slate-100 rounded-lg transition-all"
								>
									<FiX size={20} />
								</button>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium text-slate-700 mb-2">
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
									<label className="block text-sm font-medium text-slate-700 mb-2">
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
									<label className="block text-sm font-medium text-slate-700 mb-2">
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
									<label className="block text-sm font-medium text-slate-700 mb-2">
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
									</select>
								</div>

								{!editingId && (
									<div className="md:col-span-2">
										<label className="block text-sm font-medium text-slate-700 mb-2">
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

							<div className="flex flex-col sm:flex-row gap-3 mt-4 pt-4 border-t border-slate-200">
								<button
									onClick={handleAddOrEdit}
									className="flex-1 px-5 py-2.5 rounded-lg transition-all font-medium flex items-center justify-center gap-2 text-sm disabled:bg-slate-400"
									style={{ backgroundColor: shopColor, color: theme.accentTextColor }}
									disabled={submitting}
								>
									<FiCheck size={16} />
									{editingId ? "Update User" : "Add User"}
								</button>
								<button
									onClick={cancelEdit}
									className="flex-1 sm:flex-none px-5 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all font-medium text-sm"
									disabled={submitting}
								>
									Cancel
								</button>
							</div>
						</div>
					)}

					<div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
						<div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
							<h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
								<FiUser size={16} />
								All Users ({users.length})
							</h3>
						</div>

						{loading ? (
							<div className="text-center py-12 text-slate-500">Loading users...</div>
						) : users.length === 0 ? (
							<div className="text-center py-12">
								<div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
									<span className="text-slate-400 text-2xl inline-flex">
										<FiUser />
									</span>
								</div>
								<p className="text-base font-semibold text-slate-900 mb-1">No users found</p>
								<p className="text-slate-600 text-sm">Click Add New User to get started</p>
							</div>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full">
									<thead className="bg-slate-50 border-b border-slate-200">
										<tr>
											<th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">ID</th>
											<th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">User Info</th>
											<th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Role</th>
											<th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Actions</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{users.map((user) => (
											<tr key={user.id} className="hover:bg-slate-50 transition-colors">
												<td className="px-4 py-3">
													<div className="flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm" style={{ backgroundColor: shopColor, color: "white" }}>
														{user.id}
													</div>
												</td>
												<td className="px-4 py-3">
													<div>
														<div className="font-semibold text-slate-900 text-sm">{user.first_name} {user.last_name}</div>
														<div className="text-xs text-slate-600 mt-0.5">{user.name}</div>
													</div>
												</td>
												<td className="px-4 py-3">
													<span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(user.role)}`}>
														{user.role.charAt(0).toUpperCase() + user.role.slice(1)}
													</span>
												</td>
												<td className="px-4 py-3">
													<div className="flex gap-2 justify-end">
														<button
															onClick={() => startEdit(user)}
															className="bg-yellow-500 hover:bg-yellow-600 text-white p-2 rounded-lg transition-all"
															title="Edit user"
															disabled={submitting}
														>
															<FiEdit size={16} />
														</button>
														<button
															onClick={() => openPasswordModal(user.id)}
															className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition-all"
															title="Change password"
															disabled={submitting}
														>
															<FiLock size={16} />
														</button>
														<button
															onClick={() => openForgotPasswordModal(user)}
															className="p-2 rounded-lg transition-all"
															style={{ backgroundColor: shopColor, color: "white" }}
															title="Forgot password reset"
															disabled={submitting}
														>
															<FiRefreshCw size={16} />
														</button>
														<button
															onClick={() => handleDelete(user.id)}
															className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-all"
															title="Delete user"
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
							<div className="bg-white rounded-lg w-full max-w-md shadow-2xl">
								<div className="px-4 py-3 rounded-t-lg" style={{ backgroundColor: shopColor }}>
									<div className="flex items-center justify-between">
										<h3 className="text-lg font-bold flex items-center gap-2" style={{ color: theme.accentTextColor }}>
											<FiLock size={18} />
											Change Password
										</h3>
										<button
											onClick={closePasswordModal}
											className="hover:bg-white/20 p-1.5 rounded-lg transition-all"
											style={{ color: theme.accentTextColor }}
										>
											<FiX size={20} />
										</button>
									</div>
								</div>

								<div className="p-4 space-y-4">
									<div>
										<label className="block text-sm font-medium text-slate-700 mb-2">Current Password <span className="text-red-600">*</span></label>
										<input
											type="password"
											placeholder="Enter current password"
											className={accentInputClass}
											value={passwordChange.current_password}
											onChange={(e) => setPasswordChange({ ...passwordChange, current_password: e.target.value })}
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-slate-700 mb-2">New Password <span className="text-red-600">*</span></label>
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
										className="flex-1 px-5 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all font-medium text-sm"
										disabled={submitting}
									>
										Cancel
									</button>
									<button
										onClick={handleChangePassword}
										className="flex-1 px-5 py-2.5 rounded-lg transition-all font-medium flex items-center justify-center gap-2 text-sm disabled:bg-slate-400"
										style={{ backgroundColor: shopColor, color: theme.accentTextColor }}
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
							<div className="bg-white rounded-lg w-full max-w-md shadow-2xl">
								<div className="px-4 py-3 rounded-t-lg" style={{ backgroundColor: shopColor }}>
									<div className="flex items-center justify-between">
										<h3 className="text-lg font-bold flex items-center gap-2" style={{ color: theme.accentTextColor }}>
											<FiRefreshCw size={18} />
											Forgot Password Reset
										</h3>
										<button
											onClick={closeForgotPasswordModal}
											className="hover:bg-white/20 p-1.5 rounded-lg transition-all"
											style={{ color: theme.accentTextColor }}
										>
											<FiX size={20} />
										</button>
									</div>
								</div>

								<div className="p-4 space-y-4">
									<p className="text-xs text-slate-500">For security, confirm the username before setting a new password.</p>
									<div>
										<label className="block text-sm font-medium text-slate-700 mb-2">Username <span className="text-red-600">*</span></label>
										<input
											type="text"
											placeholder="Confirm username"
											className={accentInputClass}
											value={forgotPassword.username}
											onChange={(e) => setForgotPassword({ ...forgotPassword, username: e.target.value })}
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-slate-700 mb-2">New Password <span className="text-red-600">*</span></label>
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
										className="flex-1 px-5 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all font-medium text-sm"
										disabled={submitting}
									>
										Cancel
									</button>
									<button
										onClick={handleForgotPasswordReset}
										className="flex-1 px-5 py-2.5 rounded-lg transition-all font-medium flex items-center justify-center gap-2 text-sm disabled:bg-slate-400"
										style={{ backgroundColor: shopColor, color: theme.accentTextColor }}
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
						<div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
							<div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
								<h3 className="text-lg font-bold text-slate-900 mb-2">{modal.title}</h3>
								<p className="text-slate-600 mb-5 text-sm">{modal.message}</p>
								<div className="flex justify-end">
									<button
										onClick={closeModal}
										className="px-4 py-2 rounded-lg transition-colors font-medium"
										style={{ backgroundColor: shopColor, color: theme.accentTextColor }}
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
