import { supabase } from '../lib/supabase';

export const transactionService = {
  async getAll(userId, page = 0, pageSize = 50, fetchAll = false) {
    let query = supabase
      .from('transactions')
      .select('id, description, amount, type, payment_method, date, subtitle, client_name, is_bakery_income, recurrence, exam, health_plan, status, expense_type, interest_rate, active, end_date, user_email, installments, current_installment, created_at', { count: 'exact' })
      .order('date', { ascending: false });

    let start = 0;
    let end = 0;

    if (!fetchAll) {
        start = page * pageSize;
        end = start + pageSize - 1;
        query = query.range(start, end);
    }

    const { data, error, count } = await query;
    
    if (error) throw error;
    
    if (fetchAll) {
        return { data, count, hasMore: false };
    }
    
    return { data, count, hasMore: start + data.length < count };
  },

  async create(transaction) {
    let t = transaction;
    // Handle Installments
    if (t.installments && t.installments > 1) {
        const installmentCount = t.installments;
        const installmentAmount = Number((t.amount / installmentCount).toFixed(2));
        
        // Adjust for rounding error in last installment
        const totalCalculated = installmentAmount * (installmentCount - 1);
        const lastInstallmentAmount = Number((t.amount - totalCalculated).toFixed(2));

        const transactionsToInsert = [];
        const [year, month, day] = t.date.split('-');
        let currentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

        for (let i = 1; i <= installmentCount; i++) {
            const currentAmount = i === installmentCount ? lastInstallmentAmount : installmentAmount;
            
            const installDate = new Date(currentDate);
            
            // Se a recorrência original for semanal, adiciona semanas em vez de meses
            if (t.recurrence === 'weekly') {
                if (i > 1) {
                    installDate.setDate(installDate.getDate() + ((i - 1) * 7));
                }
            } else {
                // Adicionar meses (recorrência mensal padrão para parcelamento)
                if (i > 1) {
                    installDate.setMonth(installDate.getMonth() + (i - 1));
                }
            }

            const formattedInstallDate = `${installDate.getFullYear()}-${String(installDate.getMonth() + 1).padStart(2, '0')}-${String(installDate.getDate()).padStart(2, '0')}`;

            transactionsToInsert.push({
                ...t,
                amount: currentAmount,
                date: formattedInstallDate,
                current_installment: i,
                active: i === installmentCount ? false : true,
                end_date: formattedInstallDate,
                recurrence: null
            });
        }

        const { data, error } = await supabase
          .from('transactions')
          .insert(transactionsToInsert)
          .select();

        if (error) throw error;
        return data;
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert([transaction])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  },

  async deleteMany(ids) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .in('id', ids);
    
    if (error) throw error;
    return true;
  },

  async createMany(transactions) {
    const { data, error } = await supabase
      .from('transactions')
      .insert(transactions)
      .select();
    
    if (error) throw error;
    return data;
  },

  async checkExistingBakeryIncome(userId, dates) {
    const { data, error } = await supabase
        .from('transactions')
        .select('date')
        .in('date', dates)
        .like('description', 'Lucro Padaria%');
        
    if (error) throw error;
    return data;
  },

  async finalizeRecurrence(userId, description, endDate) {
    // 1. Update all existing transactions with same description and type='expense'
    // to have active=false and end_date=endDate
    const { error } = await supabase
        .from('transactions')
        .update({ 
            active: false,
            end_date: endDate
        })
        .eq('description', description)
        .eq('type', 'expense')
        .eq('expense_type', 'fixed');

    if (error) throw error;
    return true;
  },

  async reactivateRecurrence(userId, description) {
    // 1. Update all existing transactions with same description and type='expense'
    // to have active=true and end_date=null
    const { error } = await supabase
        .from('transactions')
        .update({ 
            active: true,
            end_date: null
        })
        .eq('description', description)
        .eq('type', 'expense')
        .eq('expense_type', 'fixed');

    if (error) throw error;
    return true;
  }
};