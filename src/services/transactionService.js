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