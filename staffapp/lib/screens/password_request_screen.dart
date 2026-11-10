import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../core/api_client.dart';
import '../core/app_colors.dart';

class PasswordRequestScreen extends StatefulWidget {
  const PasswordRequestScreen({super.key});

  @override
  State<PasswordRequestScreen> createState() => _PasswordRequestScreenState();
}

class _PasswordRequestScreenState extends State<PasswordRequestScreen> {
  final _message = TextEditingController();
  late Future<dynamic> _requests;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _requests = _load();
  }

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<dynamic> _load() => ApiClient.get('/api/staff/my/password-requests');

  void _refresh() => setState(() => _requests = _load());

  void _snack(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _send() async {
    setState(() => _sending = true);
    try {
      await ApiClient.post('/api/staff/my/password-requests', {
        'message': _message.text.trim(),
      });
      _message.clear();
      _snack('Request sent. Admin will reply here with your new password.');
      _refresh();
    } catch (e) {
      _snack(e.toString().replaceAll('Exception:', '').trim());
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  String _formatTime(dynamic value) {
    final time = DateTime.tryParse(value?.toString() ?? '');
    if (time == null) return '';
    return DateFormat('dd MMM yyyy, hh:mm a').format(time.toLocal());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFD),
      appBar: AppBar(title: const Text('Change Password')),
      body: FutureBuilder<dynamic>(
        future: _requests,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Could not load your password requests.'),
                  TextButton(onPressed: _refresh, child: const Text('Retry')),
                ],
              ),
            );
          }
          final requests = (snapshot.data as List<dynamic>?) ?? [];
          final hasPending = requests.any((r) => r['status'] == 'pending');
          return RefreshIndicator(
            onRefresh: () async {
              _refresh();
              await _requests;
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                _card(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Request a new password',
                        style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Your request goes to the admin. They will set a new password and reply here.',
                        style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF64748B)),
                      ),
                      const SizedBox(height: 12),
                      if (hasPending)
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFFBEB),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFFDE68A)),
                          ),
                          child: Text(
                            'Your request is waiting for the admin to reply.',
                            style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF92400E)),
                          ),
                        )
                      else ...[
                        TextField(
                          controller: _message,
                          enabled: !_sending,
                          maxLength: 500,
                          minLines: 2,
                          maxLines: 4,
                          decoration: const InputDecoration(
                            labelText: 'Message to admin (optional)',
                            hintText: 'e.g. I forgot my password / I want a new password',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 8),
                        FilledButton.icon(
                          onPressed: _sending ? null : _send,
                          icon: const Icon(Icons.send_rounded, size: 18),
                          label: Text(_sending ? 'Sending…' : 'Send request to admin'),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  'My requests',
                  style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                if (requests.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Text(
                      'No requests yet.',
                      style: GoogleFonts.inter(color: const Color(0xFF64748B)),
                    ),
                  ),
                for (final r in requests) ...[
                  _requestCard(r),
                  const SizedBox(height: 10),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _card({required Widget child}) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: child,
      );

  Widget _requestCard(dynamic r) {
    final status = (r['status'] ?? 'pending').toString();
    final (label, color) = switch (status) {
      'completed' => ('Password changed', const Color(0xFF15803D)),
      'rejected' => ('Replied', const Color(0xFFB91C1C)),
      _ => ('Waiting for admin', const Color(0xFFB45309)),
    };
    final message = (r['message'] ?? '').toString();
    final reply = (r['adminReply'] ?? '').toString();
    final newPassword = (r['newPassword'] ?? '').toString();

    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Requested ${_formatTime(r['createdAt'])}',
                  style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF64748B)),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  label,
                  style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: color),
                ),
              ),
            ],
          ),
          if (message.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text('You: $message', style: GoogleFonts.inter(fontSize: 13)),
          ],
          if (newPassword.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFBBF7D0)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'New password',
                          style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF15803D)),
                        ),
                        SelectableText(
                          newPassword,
                          style: GoogleFonts.robotoMono(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Copy',
                    icon: const Icon(Icons.copy_rounded, color: AppColors.primary),
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: newPassword));
                      _snack('Password copied');
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Use this password the next time you log in.',
              style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF64748B)),
            ),
          ],
          if (reply.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              'Admin: $reply',
              style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500),
            ),
          ],
          if (r['resolvedAt'] != null) ...[
            const SizedBox(height: 4),
            Text(
              'Replied ${_formatTime(r['resolvedAt'])}',
              style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF94A3B8)),
            ),
          ],
        ],
      ),
    );
  }
}
