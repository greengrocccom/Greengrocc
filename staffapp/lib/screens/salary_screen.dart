import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../core/app_colors.dart';
import '../core/api_client.dart';
import '../core/session_manager.dart';

class SalaryScreen extends StatefulWidget {
  const SalaryScreen({super.key});

  @override
  State<SalaryScreen> createState() => _SalaryScreenState();
}

class _SalaryScreenState extends State<SalaryScreen> {
  bool _isLoading = true;
  int _selectedMonthIndex = 0;
  Map<String, dynamic> _staff = {};
  Map<String, dynamic>? _employment;
  List<Map<String, dynamic>> _records = [];
  List<String> _months = [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final staff = await SessionManager.getStaff();
      if (staff != null) {
        _staff = staff;
      }

      final res = await ApiClient.get('/api/staff/my/salary');
      if (res != null) {
        final employment = res['employment'] as Map<String, dynamic>?;
        final payrolls = (res['payrolls'] as List?)?.cast<Map<String, dynamic>>() ?? [];

        _employment = employment;

        final List<Map<String, dynamic>> mapped = [];
        final List<String> monthLabels = [];

        final inrFormatter = NumberFormat('#,##,###');

        if (payrolls.isNotEmpty) {
          for (final p in payrolls) {
            final monthStr = p['month'] ?? '';
            String displayMonth = monthStr;
            try {
              if (monthStr.length == 7) {
                final dt = DateTime.parse('$monthStr-01');
                displayMonth = DateFormat('MMMM yyyy').format(dt);
              }
            } catch (_) {}

            final gross = (p['gross'] as num?)?.toDouble() ?? 0;
            final tax = (p['tax'] as num?)?.toDouble() ?? 0;
            final deductions = (p['deductions'] as num?)?.toDouble() ?? 0;
            final net = (p['net'] as num?)?.toDouble() ?? (gross - tax - deductions);
            final notes = p['notes']?.toString() ?? '';

            String paidOn = 'Disbursed';
            if (p['paidAt'] != null) {
              try {
                final dt = DateTime.parse(p['paidAt'].toString());
                paidOn = DateFormat('dd MMM yyyy').format(dt);
              } catch (_) {}
            }

            monthLabels.add(displayMonth);
            mapped.add({
              'grossNum': inrFormatter.format(gross.round()),
              'taxNum': inrFormatter.format(tax.round()),
              'deductionsNum': inrFormatter.format(deductions.round()),
              'netNum': inrFormatter.format(net.round()),
              'grossRaw': gross,
              'taxRaw': tax,
              'deductionsRaw': deductions,
              'netRaw': net,
              'notes': notes,
              'paidOn': paidOn,
              'status': p['status'] ?? 'paid',
            });
          }
        } else if (employment != null && (employment['monthlySalary'] as num? ?? 0) > 0) {
          final salary = (employment['monthlySalary'] as num).toDouble();
          final tax = (employment['salaryTax'] as num?)?.toDouble() ?? 0;
          final net = (salary - tax).clamp(0, double.infinity);
          final notes = employment['workNotes']?.toString() ?? '';
          final currentMonthLabel = DateFormat('MMMM yyyy').format(DateTime.now());

          monthLabels.add(currentMonthLabel);
          mapped.add({
            'grossNum': inrFormatter.format(salary.round()),
            'taxNum': inrFormatter.format(tax.round()),
            'deductionsNum': '0',
            'netNum': inrFormatter.format(net.round()),
            'grossRaw': salary,
            'taxRaw': tax,
            'deductionsRaw': 0.0,
            'netRaw': net,
            'notes': notes,
            'paidOn': 'Due on ${employment['salaryDate'] ?? "1st of next month"}',
            'status': 'upcoming',
          });
        }

        if (mounted) {
          setState(() {
            _records = mapped;
            _months = monthLabels;
            _selectedMonthIndex = 0;
            _isLoading = false;
          });
        }
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showMonthPicker() {
    if (_months.isEmpty) return;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Select Pay Period', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            ..._months.asMap().entries.map((entry) {
              final isSel = entry.key == _selectedMonthIndex;
              return ListTile(
                title: Text(entry.value, style: GoogleFonts.inter(fontWeight: isSel ? FontWeight.bold : FontWeight.w500)),
                trailing: isSel ? const Icon(Icons.check_circle_rounded, color: AppColors.primary) : null,
                onTap: () {
                  setState(() => _selectedMonthIndex = entry.key);
                  Navigator.pop(ctx);
                },
              );
            }),
          ],
        ),
      ),
    );
  }

  void _showPayslipModal() {
    if (_records.isEmpty) return;
    final d = _records[_selectedMonthIndex];
    final monthName = _months[_selectedMonthIndex];

    final employeeName = _staff['name'] ?? 'Staff Member';
    final staffId = _staff['staffId'] ?? '—';
    final designation = _staff['roleTitle'] ?? _staff['role'] ?? (_employment?['department'] ?? 'Staff Member');
    final bank = _employment?['bankAccount'] ?? 'Direct Bank Transfer';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.eco_rounded, color: AppColors.brandGreen, size: 24),
                    const SizedBox(width: 6),
                    Text('GreenGrocc Pay Slip', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold)),
                  ],
                ),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            Text('Period: $monthName  •  ${d['paidOn']}', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSecondary)),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(10)),
              child: Column(
                children: [
                  _payslipRow('Employee Name', employeeName),
                  _payslipRow('Staff ID', staffId),
                  _payslipRow('Designation', designation),
                  _payslipRow('Bank Account', bank),
                ],
              ),
            ),
            const SizedBox(height: 14),
            _payslipRow('Monthly Salary', '₹ ${d['grossNum']}', isBold: true),
            if ((d['taxRaw'] as num) > 0)
              _payslipRow('Tax Deducted', '- ₹ ${d['taxNum']}'),
            if ((d['deductionsRaw'] as num) > 0)
              _payslipRow('Other Deductions', '- ₹ ${d['deductionsNum']}'),
            const Divider(),
            _payslipRow('Final Salary Disbursed', '₹ ${d['netNum']}', isBold: true, isHighlight: true),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Payslip downloaded to device storage.')),
                );
              },
              icon: const Icon(Icons.download_rounded, color: Colors.white, size: 18),
              label: const Text('Download Payslip PDF', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _payslipRow(String label, String value, {bool isBold = false, bool isHighlight = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.inter(fontSize: 12, color: isHighlight ? AppColors.primary : AppColors.textSecondary, fontWeight: isBold ? FontWeight.bold : FontWeight.normal)),
          Text(value, style: GoogleFonts.inter(fontSize: isHighlight ? 14 : 12, fontWeight: FontWeight.bold, color: isHighlight ? AppColors.primary : const Color(0xFF0F172A))),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        backgroundColor: const Color(0xFFF8FAFD),
        appBar: AppBar(
          backgroundColor: AppColors.primary,
          elevation: 0,
          centerTitle: true,
          iconTheme: const IconThemeData(color: Colors.white),
          title: Text(
            'Salary Details',
            style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
          ),
        ),
        body: const Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }

    final hasData = _records.isNotEmpty;
    final d = hasData ? _records[_selectedMonthIndex] : null;
    final bankAccount = _employment?['bankAccount'] ?? 'Not configured';
    final ifsc = _employment?['ifsc'] ?? 'Not configured';
    final upi = _employment?['upi']?.toString().trim();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFD),
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        elevation: 0,
        centerTitle: true,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          'Salary Details',
          style: GoogleFonts.outfit(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        color: AppColors.primary,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (hasData) ...[
                // Month Selector
                GestureDetector(
                  onTap: _showMonthPicker,
                  child: Row(
                    children: [
                      Text(
                        _months[_selectedMonthIndex],
                        style: GoogleFonts.outfit(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(Icons.keyboard_arrow_down_rounded, color: AppColors.textSecondary, size: 20),
                    ],
                  ),
                ),

                const SizedBox(height: 12),

                // 1. Net Pay Card
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              d!['status'] == 'paid' ? 'Final Salary Disbursed' : 'Expected Final Salary',
                              style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '₹ ${d['netNum']}',
                              style: GoogleFonts.outfit(
                                fontSize: 26,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF0F172A),
                              ),
                            ),
                          ],
                        ),
                      ),
                      OutlinedButton(
                        onPressed: _showPayslipModal,
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFFBFDBFE)),
                          backgroundColor: const Color(0xFFEFF6FF),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        ),
                        child: Text(
                          'View Payslip',
                          style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // 2. Salary Breakdown Card (Shows only admin-entered fields, nothing more)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Salary Breakdown', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold)),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: d['status'] == 'paid' ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              d['status'] == 'paid' ? 'Paid' : 'Pending',
                              style: GoogleFonts.inter(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: d['status'] == 'paid' ? const Color(0xFF15803D) : const Color(0xFFB45309),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),

                      _buildRow('Monthly Salary', d['grossNum']),

                      if ((d['taxRaw'] as num) > 0)
                        _buildRow('Tax', d['taxNum'], isDeduction: true),

                      if ((d['deductionsRaw'] as num) > 0)
                        _buildRow('Deductions', d['deductionsNum'], isDeduction: true),

                      const SizedBox(height: 8),
                      const Divider(color: Color(0xFFF1F5F9)),
                      const SizedBox(height: 6),

                      _buildRow('Final Salary', d['netNum'], isBold: true, isNet: true),

                      if (d['notes'] != null && d['notes'].toString().trim().isNotEmpty) ...[
                        const SizedBox(height: 12),
                        const Divider(color: Color(0xFFF1F5F9)),
                        const SizedBox(height: 6),
                        Text('Remarks / Notes', style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textSecondary)),
                        const SizedBox(height: 4),
                        Text(d['notes'].toString().trim(), style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF334155), height: 1.3)),
                      ],
                    ],
                  ),
                ),
              ] else ...[
                // Empty state when no salary configured yet
                Container(
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    children: [
                      const Icon(Icons.account_balance_wallet_outlined, size: 54, color: AppColors.textMuted),
                      const SizedBox(height: 14),
                      Text(
                        'No Salary Records Yet',
                        style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: const Color(0xFF0F172A)),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Salary details will appear here once entered by admin in HR Management.',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 16),

              // 3. Bank & Account Details Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.account_balance_rounded, color: AppColors.primary, size: 20),
                        ),
                        const SizedBox(width: 10),
                        Text('Bank & Payment Details', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 14),
                    _buildBankRow('Account No.', bankAccount),
                    _buildBankRow('IFSC', ifsc),
                    if (upi != null && upi.isNotEmpty && upi != '—')
                      _buildBankRow('UPI ID', upi),
                    _buildBankRow('Disbursement Day', _employment?['salaryDate'] ?? '1st of every month'),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRow(String title, String amount, {bool isBold = false, bool isDeduction = false, bool isNet = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: GoogleFonts.inter(
              fontSize: isBold ? 13 : 12,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w400,
              color: isNet ? AppColors.primary : const Color(0xFF334155),
            ),
          ),
          Text(
            '${isDeduction ? "- " : ""}₹ $amount',
            style: GoogleFonts.inter(
              fontSize: isBold ? 14 : 12,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
              color: isDeduction
                  ? const Color(0xFFB91C1C)
                  : (isNet ? AppColors.primary : const Color(0xFF0F172A)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBankRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSecondary)),
          Text(value, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF0F172A))),
        ],
      ),
    );
  }
}
