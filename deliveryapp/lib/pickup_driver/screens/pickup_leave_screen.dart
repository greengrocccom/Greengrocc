import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import '../pickup_driver_service.dart';
import '../pickup_flow.dart';
import '../widgets/pickup_ui.dart';

List<(String, String)> _leaveTypes(AppLocalizations l10n) => [
      ('casual', l10n.pksLeaveCasual),
      ('sick', l10n.pksLeaveSick),
      ('earned', l10n.pksLeaveEarned),
      ('unpaid', l10n.pksLeaveUnpaid),
    ];

/// Leave requests for pickup drivers — mirrors vendor `DriverLeavePage`.
class PickupLeaveScreen extends StatefulWidget {
  const PickupLeaveScreen({super.key});

  @override
  State<PickupLeaveScreen> createState() => _PickupLeaveScreenState();
}

class _PickupLeaveScreenState extends State<PickupLeaveScreen> {
  final _svc = PickupDriverService.instance;
  final _reason = TextEditingController();
  String _leaveType = 'casual';
  final List<String> _dates = [];
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  bool _saving = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final rows = await _svc.myLeaves();
      if (!mounted) return;
      setState(() {
        _rows = rows;
        _loading = false;
        _error = '';
      });
    } catch (e) {
      if (!mounted) return;
      if (await handlePickupAuthError(context, e)) return;
      setState(() {
        _loading = false;
        _error = pickupErrorText(e);
      });
    }
  }

  String _ymd(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _addDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: now.subtract(const Duration(days: 30)),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked == null) return;
    final day = _ymd(picked);
    setState(() {
      if (!_dates.contains(day)) _dates.add(day);
      _dates.sort();
    });
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    if (_dates.isEmpty) {
      setState(() => _error = l10n.pksAddLeaveDateError);
      return;
    }
    if (_reason.text.trim().isEmpty) {
      setState(() => _error = l10n.pksEnterReasonError);
      return;
    }
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      await _svc.applyLeave(
        leaveType: _leaveType,
        reason: _reason.text.trim(),
        dates: List.of(_dates),
      );
      if (!mounted) return;
      _reason.clear();
      setState(() {
        _dates.clear();
        _leaveType = 'casual';
      });
      showPickupSnack(context, l10n.pksLeaveSubmitted);
      await _load();
    } catch (e) {
      if (!mounted) return;
      if (await handlePickupAuthError(context, e)) return;
      setState(() => _error = pickupErrorText(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String _formatDates(Map<String, dynamic> row) {
    final dates = row['dates'];
    if (dates is List && dates.isNotEmpty) return dates.map(str).join(', ');
    final from = str(row['fromDate']);
    final to = str(row['toDate']);
    if (from.isNotEmpty && to.isNotEmpty && from != to) return '$from → $to';
    return from.isEmpty ? '—' : from;
  }

  (Color, Color) _tone(String status) {
    if (status == 'approved') {
      return (const Color(0xFFECFDF5), const Color(0xFF047857));
    }
    if (status == 'rejected') {
      return (const Color(0xFFFFF1F2), const Color(0xFFBE123C));
    }
    return (const Color(0xFFFFFBEB), const Color(0xFFB45309));
  }

  String _statusLabel(AppLocalizations l10n, String status) => switch (status) {
        'pending' => l10n.pending,
        'approved' => l10n.pksLeaveApproved,
        'rejected' => l10n.pksLeaveRejected,
        _ => status,
      };

  String _typeLabel(AppLocalizations l10n, String type) {
    for (final t in _leaveTypes(l10n)) {
      if (t.$1 == type) return t.$2;
    }
    return type.isEmpty ? '' : type[0].toUpperCase() + type.substring(1);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: PickupColors.page,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        title: Text(l10n.pksApplyForLeave,
            style: pickupText(17, weight: FontWeight.w800)),
      ),
      body: RefreshIndicator(
        color: PickupColors.brand,
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
          children: [
            Text(l10n.pksLeaveIntro,
                style: pickupText(13, color: PickupColors.muted)),
            if (_error.isNotEmpty) ...[
              const SizedBox(height: 12),
              ErrorBanner(_error),
            ],
            const SizedBox(height: 14),
            PickupCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.pksTypeOfLeave,
                      style: pickupText(12.5, weight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final t in _leaveTypes(l10n))
                        ChoiceChip(
                          label: Text(t.$2),
                          selected: _leaveType == t.$1,
                          selectedColor: PickupColors.brandSoft,
                          labelStyle: pickupText(13,
                              weight: FontWeight.w600,
                              color: _leaveType == t.$1
                                  ? PickupColors.brand
                                  : PickupColors.text),
                          onSelected: (_) =>
                              setState(() => _leaveType = t.$1),
                        ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Text(l10n.pksReason,
                      style: pickupText(12.5, weight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _reason,
                    minLines: 3,
                    maxLines: 5,
                    decoration: InputDecoration(
                      hintText: l10n.pksLeaveReasonHint,
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(l10n.pksLeaveDates,
                      style: pickupText(12.5, weight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(l10n.pksLeaveDatesHint,
                      style: pickupText(11.5, color: PickupColors.faint)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      for (final d in _dates)
                        InputChip(
                          label: Text(d),
                          backgroundColor: PickupColors.brandSoft,
                          labelStyle: pickupText(12.5,
                              weight: FontWeight.w700,
                              color: PickupColors.brand),
                          onDeleted: () => setState(() => _dates.remove(d)),
                        ),
                      ActionChip(
                        avatar: const Icon(Icons.add, size: 18),
                        label: Text(l10n.pksAddDate),
                        onPressed: _addDate,
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  PickupButton(
                    label: l10n.pksSubmitLeaveRequest,
                    busy: _saving,
                    onPressed: _submit,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            PickupCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.pksMyLeaveRequests,
                      style: pickupText(14, weight: FontWeight.w800)),
                  const SizedBox(height: 10),
                  if (_loading)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.all(16),
                        child: CircularProgressIndicator(
                            color: PickupColors.brand),
                      ),
                    )
                  else if (_rows.isEmpty)
                    Text(l10n.pksNoLeaveRequests,
                        style: pickupText(13, color: PickupColors.faint))
                  else
                    for (final row in _rows) ...[
                      _leaveRow(l10n, row),
                      const SizedBox(height: 10),
                    ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _leaveRow(AppLocalizations l10n, Map<String, dynamic> row) {
    final status = str(row['status']).isEmpty ? 'pending' : str(row['status']);
    final tone = _tone(status);
    final type = str(row['leaveType']);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  l10n.pksLeaveTypeTitle(_typeLabel(l10n, type)),
                  style: pickupText(13.5, weight: FontWeight.w700),
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: tone.$1,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(_statusLabel(l10n, status),
                    style: pickupText(11,
                        weight: FontWeight.w700, color: tone.$2)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(_formatDates(row),
              style: pickupText(12, color: PickupColors.muted)),
          if (str(row['reason']).isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(str(row['reason']), style: pickupText(13)),
          ],
          if (str(row['adminNotes']).isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(l10n.pksAdminNote(str(row['adminNotes'])),
                style: pickupText(12, color: PickupColors.muted)),
          ],
        ],
      ),
    );
  }
}
